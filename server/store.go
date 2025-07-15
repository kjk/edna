package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/kjk/common/appendstore"
)

// AppendStoreRecord represents a record in the append store index
type AppendStoreRecord struct {
	Offset      int64  // byte offset in data file
	Size        int64  // size of data in bytes
	TimestampMs int64  // timestamp in milliseconds
	Kind        string // record type/kind
	Meta        string // optional metadata (can be empty)
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

func serve404(w http.ResponseWriter, r *http.Request, s string) {
	http.Error(w, s, http.StatusNotFound)
}

type GetNotesResponse struct {
	Ver          string
	LastChangeID int
	NotesCompact [][]interface{}
}

const kStoreKindCreateNote = "note-create"
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
	isDeleted   bool
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

func notesFromStoreLog(records []*appendstore.Record) (map[string]*NoteInfo, error) {
	notes := make(map[string]*NoteInfo)
	for _, rec := range records {
		switch rec.Kind {
		case kStoreKindCreateNote:
			// meta is "noteId:name"
			parts := strings.SplitN(rec.Meta, ":", 2)
			id := parts[0]
			name := parts[1]
			ni := &NoteInfo{
				id:        id,
				name:      name,
				createdAt: rec.TimestampMs,
			}
			panicIf(notes[id] != nil, fmt.Errorf("note with id %s already exists", id))
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
			panicIf(note.isDeleted, fmt.Errorf("note %s is deleted but trying to apply metadata", noteMeta.Id))
			applyMetadata(note, &noteMeta)
			note.modifiedAt = rec.TimestampMs
		case kStoreKindDeleteNote:
			noteId := rec.Meta
			note := notes[noteId]
			note.isDeleted = true
		case kStoreKindNoteContent:
			verId := rec.Meta // verId is noteId:verId
			noteId := strings.SplitN(rec.Meta, ":", 2)[0]
			note := notes[noteId]
			panicIf(note.isDeleted, fmt.Errorf("note %s is deleted but trying to apply metadata", noteId))
			note.versionIds = append(note.versionIds, verId)
		}
	}

	return notes, nil
}

const kNoteFlagIsStarred = 0x01
const kNoteFlagIsArchived = 0x02

func handleStoreGetNotes(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	lastChangeIDReq := 0
	v := r.FormValue("lastChangeID")
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
	notesCompact := make([][]interface{}, 0, len(notes))

	for _, ni := range notes {
		if ni.isDeleted {
			continue
		}
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
		push(&notesCompact, nc)
	}
	serve200JSON(w, r, rsp)
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

	err = replayBrowserStoreZip(userInfo.Store, zipData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if false {
		dataDir := getDataDirMust()
		zipPath := filepath.Join(dataDir, "notes_store.zip")
		err = os.WriteFile(zipPath, zipData, 0644)
		logIfErrf(err)
		logf("handleStoreBulkUpload: user %s, wrote zip to %s\n", userInfo.Email, zipPath)
	}

	var rsp struct {
		Message string `json:"message"`
	}
	rsp.Message = fmt.Sprintf("Successfully uploaded %d records", len(userInfo.Store.Records()))
	serve200JSON(w, r, rsp)
}

func apstoreFindLatestNoteContentVersionRecord(recs []*appendstore.Record, noteId string) *appendstore.Record {
	for i := len(recs) - 1; i >= 0; i-- {
		rec := recs[i]
		if rec.Kind == kStoreKindNoteContent && strings.HasPrefix(rec.Meta, noteId+":") {
			return rec
		}
	}
	return nil
}

func handleStoreLoadLatestNoteContent(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	logf("handleStoreLoadLatestNoteContent: user %s, noteId: %s\n", userInfo.Email, r.FormValue("noteId"))
	recs := userInfo.Store.Records()
	rec := apstoreFindLatestNoteContentVersionRecord(recs, r.FormValue("noteId"))
	if rec == nil {
		http.Error(w, "No content found for note", http.StatusNotFound)
		return
	}
	content, err := userInfo.Store.ReadRecord(rec)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read note content: %s", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(content)
}

func handleStoreDeleteNote(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	noteId := r.FormValue("noteId")
	if noteId == "" {
		http.Error(w, "Missing or invalid noteId", http.StatusBadRequest)
		return
	}
	userInfo.Store.AppendRecord(kStoreKindDeleteNote, nil, noteId)
	serve200JSON(w, r, map[string]string{
		"message": "Note created"})
}

// TODO: verify that there is no note with the same name or id
func handleStoreCreateNote(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	noteId := r.FormValue("noteId")
	if noteId == "" {
		http.Error(w, "Missing or invalid noteId", http.StatusBadRequest)
		return
	}
	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Missing or invalid name", http.StatusBadRequest)
		return
	}
	meta := fmt.Sprintf("%s:%s", noteId, name)
	userInfo.Store.AppendRecord(kStoreKindCreateNote, nil, meta)
	serve200JSON(w, r, map[string]string{
		"message": "Note created"})
}

func handleStoreWriteNoteMeta(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	meta := r.FormValue("meta")
	if meta == "" {
		http.Error(w, "Missing or invalid meta", http.StatusBadRequest)
		return
	}
	// TODO: verify meta is valid JSON
	userInfo.Store.AppendRecord(kStoreKindNoteMeta, nil, meta)
	serve200JSON(w, r, map[string]string{
		"message": "Note meta set"})

}

func handleStoreWriteNoteContent(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	d, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	verId := r.FormValue("verId")
	if verId == "" {
		http.Error(w, "Missing or invalid verId", http.StatusBadRequest)
		return
	}
	userInfo.Store.AppendRecord(kStoreKindNoteContent, d, verId)
	serve200JSON(w, r, map[string]string{
		"message": "Note content written successfully"})
}

func handleStoreReadFileAsString(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	fileName := r.FormValue("fileName")
	if fileName == "" {
		http.Error(w, "Missing or invalid fileName", http.StatusBadRequest)
		return
	}
	path := filepath.Join(userInfo.DataDir, ToValidFileName(fileName))
	d, err := os.ReadFile(path)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read file %s: %s", fileName, err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(d)
}

func handleStoreWriteStringToFile(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	d, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	fileName := r.FormValue("fileName")
	if fileName == "" {
		http.Error(w, "Missing or invalid fileName", http.StatusBadRequest)
		return
	}
	path := filepath.Join(userInfo.DataDir, ToValidFileName(fileName))
	if err := os.WriteFile(path, d, 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write file %s: %s", fileName, err), http.StatusInternalServerError)
		return
	}
	serve200JSON(w, r, map[string]string{
		"message": "Note content written successfully"})
}

func handleStore(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	userInfo, err := getLoggedUser(r, w)
	if serve500IfError(w, err) {
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
	if uri == "/api/store/loadLatestNoteContent" {
		handleStoreLoadLatestNoteContent(w, r, userInfo)
		return
	}
	if uri == "/api/store/writeNoteContent" {
		handleStoreWriteNoteContent(w, r, userInfo)
		return
	}
	if uri == "/api/store/createNote" {
		handleStoreCreateNote(w, r, userInfo)
		return
	}
	if uri == "/api/store/deleteNote" {
		handleStoreDeleteNote(w, r, userInfo)
		return
	}
	if uri == "/api/store/writeNoteMeta" {
		handleStoreWriteNoteMeta(w, r, userInfo)
		return
	}
	if uri == "/api/store/writeStringToFile" {
		handleStoreWriteStringToFile(w, r, userInfo)
		return
	}
	if uri == "/api/store/readFileAsString" {
		handleStoreReadFileAsString(w, r, userInfo)
		return
	}
	serve404(w, r, "Unknown store operation: "+uri)
}
