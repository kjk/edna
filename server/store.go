package server

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kjk/common/appendstore"
)

// AppendStoreRecord represents a record in the append store index
type AppendStoreRecord struct {
	Offset   int64  // byte offset in data file
	Size     int64  // size of data in bytes
	TimeInMs int64  // timestamp in milliseconds
	Kind     string // record type/kind
	Meta     string // optional metadata (can be empty)
}

type UserInfo struct {
	User    string
	Email   string
	Store   *appendstore.Store
	DataDir string
	mu      sync.Mutex
}

var (
	users []*UserInfo

	muStore sync.Mutex
)

func getLoggedUser(r *http.Request, w http.ResponseWriter) (*UserInfo, error) {
	cookie := getSecureCookie(r)
	if cookie == nil || cookie.Email == "" {
		return nil, fmt.Errorf("user not logged in (no cookie)")
	}
	email := cookie.Email

	var userInfo *UserInfo
	getOrCreateUser := func(u *UserInfo, i int) error {
		if u != nil {
			userInfo = u
			return nil
		}

		dataDir := getDataDirMust()
		dirName := ToValidFileName(email)
		dataDir = filepath.Join(dataDir, dirName)
		err := os.MkdirAll(dataDir, 0755)
		if err != nil {
			logErrorf("getLoggedUser(): failed to create data dir for user %s, err: %s\n", email, err)
			return err
		}
		userInfo = &UserInfo{
			Email:   cookie.Email,
			User:    cookie.User,
			DataDir: dataDir,
		}

		userInfo.Store = &appendstore.Store{
			DataDir:       dataDir,
			IndexFileName: "index.txt",
			DataFileName:  "data.bin",
		}
		err = appendstore.OpenStore(userInfo.Store)
		if err != nil {
			logErrorf("getLoggedUser(): failed to open store for user %s, err: %s\n", email, err)
			return err
		}
		users = append(users, userInfo)
		userInfo = u
		return nil
	}
	doUserOpByEmail(email, getOrCreateUser)
	return userInfo, nil
}

func handleStore(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	userInfo, err := getLoggedUser(r, w)
	if serveIfError(w, err) {
		logf("handleStore: %s, err: %s\n", uri, err)
		return
	}
	logf("handleStore: %s, userEmail: %s\n", uri, userInfo.Email)

	// serialize user operations. I could try to be more fine-grained
	// but this is safe and simple
	userInfo.mu.Lock()
	defer userInfo.mu.Unlock()

	if uri == "/api/store/bulkUpload" {
		handleStoreBulkUpload(w, r, userInfo)
		return
	}
	if uri == "/api/store/getNotes" {
		handleStoreGetNotes(w, r, userInfo)
		return
	}
	serve404(w, r, "Unknown store operation: "+uri)
}

func serve404(w http.ResponseWriter, r *http.Request, s string) {
	http.Error(w, s, http.StatusNotFound)
}

type GetNotesResponse struct {
	Ver          string
	LastChangeID int
	NotesCompact [][]interface{}
}

const kStoreKinewCreateNote = "note-create"
const kStoreKindNoteMeta = "note-meta"
const kStoreKindDeleteNote = "note-delete"
const kStoreKindNoteContent = "note-content"

type NoteInfo struct {
	id          string
	name        string
	createdAt   int64
	modifiedAt  int64
	isStarred   bool
	isArchived  bool
	altShortcut string
	versionIds  []string
}

type NoteMeta struct {
	Id          string `json:"id"`
	Name        string `json:"name,omitempty"`
	IsArchived  bool   `json:"isArchived,omitempty"`
	IsStarred   bool   `json:"isStarred,omitempty"`
	AltShortcut string `json:"altShortcut,omitempty"`
}

func applyMetadata(ni *NoteInfo, noteMeta *NoteMeta) error {
	ni.name = noteMeta.Name
	ni.isArchived = noteMeta.IsArchived
	ni.isStarred = noteMeta.IsStarred
	ni.altShortcut = noteMeta.AltShortcut
	return nil
}

func notesFromStoreLog(records []*appendstore.Record) ([]*NoteInfo, error) {
	notes := make(map[string]*NoteInfo)
	for _, rec := range records {
		switch rec.Kind {
		case kStoreKinewCreateNote:
			// meta is "noteId:name"
			parts := strings.SplitN(rec.Meta, ":", 2)
			id := parts[0]
			name := parts[1]
			ni := &NoteInfo{
				id:        id,
				name:      name,
				createdAt: rec.TimestampMs,
			}
			notes[id] = ni

		case kStoreKindNoteMeta:
			var noteMeta NoteMeta
			meta := rec.Meta
			err := json.Unmarshal([]byte(meta), &noteMeta)
			if err != nil {
				logErrorf("applyMetadata: failed to unmarshal note meta: %s, err: %s\n", meta, err)
				return nil, err
			}
			note := notes[noteMeta.Id]
			applyMetadata(note, &noteMeta)
			note.modifiedAt = rec.TimestampMs
		case kStoreKindDeleteNote:
			noteId := rec.Meta
			delete(notes, noteId)
		case kStoreKindNoteContent:
			verId := rec.Meta // verId is noteId:verId
			noteId := strings.SplitN(rec.Meta, ":", 2)[0]
			note := notes[noteId]
			note.versionIds = append(note.versionIds, verId)
		}
	}

	var result []*NoteInfo
	for _, ni := range notes {
		result = append(result, ni)
	}
	return result, nil
}

const kNoteFlagIsStarred = 0x01
const kNoteFlagIsArchived = 0x02

func handleStoreGetNotes(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	lastChangeIDReq := 0
	r.ParseForm()
	v := r.Form.Get("lastChangeID")
	if v != "" {
		var err error
		lastChangeIDReq, err = strconv.Atoi(v)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid lastChangeID: %s", v), http.StatusBadRequest)
			return
		}
	}
	recs := userInfo.Store.Records()
	rsp := &GetNotesResponse{
		Ver:          "1",
		LastChangeID: len(recs),
	}
	if lastChangeIDReq >= rsp.LastChangeID {
		// no changes since last request
		serve304(w, r)
		return
	}

	notes, err := notesFromStoreLog(recs)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get notes: %s", err), http.StatusInternalServerError)
		return
	}
	notesCompact := make([][]interface{}, len(notes))

	for i, ni := range notes {
		// [id, name, flags, altShortcut, createdAt, lastModifiedAt, versionIds...],
		flags := 0
		if ni.isStarred {
			flags |= kNoteFlagIsStarred
		}
		if ni.isArchived {
			flags |= kNoteFlagIsArchived
		}
		nc := []interface{}{
			ni.id,
			ni.name,
			flags,
			ni.altShortcut,
			ni.createdAt,
			ni.modifiedAt,
		}
		for _, verId := range ni.versionIds {
			nc = append(nc, verId)
		}
		notesCompact[i] = nc
	}
	serveJSONOK(w, r, rsp)
}

func parseBrowserStore(indexData []byte, dataData []byte) ([]*AppendStoreRecord, error) {
	indexContent := string(indexData)
	records, err := parseIndex(indexContent)
	if err != nil {
		return nil, fmt.Errorf("failed to parse index: %w", err)
	}
	return records, nil
}

func parseIndex(indexContent string) ([]*AppendStoreRecord, error) {
	var records []*AppendStoreRecord

	lines := strings.Split(indexContent, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, " ", 5)
		if len(parts) < 4 {
			continue
		}

		offset, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			continue
		}

		size, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			continue
		}

		timeInMs, err := strconv.ParseInt(parts[2], 10, 64)
		if err != nil {
			continue
		}

		// Parse kind
		kind := parts[3]

		// Parse optional meta (everything after kind, space-separated parts joined back)
		var meta string
		if len(parts) > 4 {
			meta = parts[4]
		}

		record := &AppendStoreRecord{
			Offset:   offset,
			Size:     size,
			TimeInMs: timeInMs,
			Kind:     kind,
			Meta:     meta,
		}

		records = append(records, record)
	}

	return records, nil
}

func replayBrowserStore(zipData []byte) error {
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return errors.New("invalid zip file")
	}

	extractFile := func(file *zip.File) []byte {
		rc, err := file.Open()
		if err == nil {
			defer rc.Close()
			data, err := io.ReadAll(rc)
			if err == nil {
				return data
			}
		}
		return nil
	}

	var indexData, dataData []byte
	for _, file := range zipReader.File {
		switch file.Name {
		case "notes_store_index.txt":
			indexData = extractFile(file)
		case "notes_store_data.bin":
			dataData = extractFile(file)
		}
	}

	if indexData == nil || dataData == nil {
		return errors.New("zip file must contain notes_store_index.txt and notes_store_data.bin")
	}
	recs, err := parseIndex(string(indexData))
	if err != nil {
		return err
	}

	// validate records
	dataSize := int64(len(dataData))
	for _, rec := range recs {
		end := rec.Offset + rec.Size
		if end > dataSize {
			return fmt.Errorf("record %v has invalid offset/size: offset=%d, size=%d, data size=%d",
				rec, rec.Offset, rec.Size, dataSize)
		}
	}
	return nil
}

func handleStoreBulkUpload(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	if !verifyPOSTRequest(w, r) {
		return
	}

	zipData, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	logf("handleStoreBulkUpload: user %s, zip size: %d\n", userInfo.Email, len(zipData))

	err = replayBrowserStore(zipData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	dataDir := getDataDirMust()
	zipPath := filepath.Join(dataDir, "notes_store.zip")
	err = os.WriteFile(zipPath, zipData, 0644)
	logIfErrf(err)
	logf("handleStoreBulkUpload: user %s, wrote zip to %s\n", userInfo.Email, zipPath)

	http.Error(w, "Bulk upload not implemented yet", http.StatusNotImplemented)
}

const shortIDSymbols = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

var nShortSymbols = len(shortIDSymbols)

func genRandomID(n int) string {
	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	res := ""
	for i := 0; i < n; i++ {
		idx := rnd.Intn(nShortSymbols)
		c := string(shortIDSymbols[idx])
		res = res + c
	}
	return res
}
