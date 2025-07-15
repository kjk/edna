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
		return nil
	}
	doUserOpByEmail(email, getOrCreateUser)
	return userInfo, nil
}

func serve404(w http.ResponseWriter, r *http.Request, s string) {
	http.Error(w, s, http.StatusNotFound)
}

type GetNotesResponse struct {
	Ver          int
	LastChangeID int
	NotesCompact [][]interface{}
}

// must match store-local.js
const kStoreCreateNote = "note-create"
const kStoreDeleteNote = "note-delete"
const kStoreSetNoteMeta = "note-meta"
const kStorePut = "put"

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
	logf("notesFromStoreLog: processing %d records\n", len(records))
	notes := make(map[string]*NoteInfo)
	for _, rec := range records {
		switch rec.Kind {
		case kStoreCreateNote:
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
		case kStoreSetNoteMeta:
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
		case kStoreDeleteNote:
			noteId := rec.Meta
			note := notes[noteId]
			note.isDeleted = true
		case kStorePut:
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

// as an optimization, we only send the last version id of note content
// front-end doesn't need more and can request more if needed
func handleStoreGetNotes(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	logf("handleStoreGetNotes: user %s\n", userInfo.Email)
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
		Ver:          1,
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
		// [id, name, flags, altShortcut, createdAt, lastModifiedAt, lastVersionId],
		flags := 0
		if ni.isStarred {
			flags |= kNoteFlagIsStarred
		}
		if ni.isArchived {
			flags |= kNoteFlagIsArchived
		}
		lastVersionId := ""
		if len(ni.versionIds) > 0 {
			lastVersionId = ni.versionIds[len(ni.versionIds)-1]
		}
		nc := []interface{}{
			ni.id,
			ni.name,
			flags,
			ni.altShortcut,
			ni.createdAt,
			ni.modifiedAt,
			lastVersionId,
		}
		push(&notesCompact, nc)
	}
	rsp.NotesCompact = notesCompact
	serve200JSON(w, r, rsp)
}

func maybeSaveIndexAndData(dataDir string, index []byte, data []byte) {
	if !isDev() || dataDir == "" {
		// only when testing
		return
	}
	os.MkdirAll(dataDir, 0755)
	path := filepath.Join(dataDir, "index.txt")
	os.WriteFile(path, index, 0644)
	path = filepath.Join(dataDir, "data.bin")
	os.WriteFile(path, data, 0644)
}

func maybeSaveUploadedZip(dataDir string, zipData []byte) {
	if !isDev() {
		// only when testing
		return
	}
	// pick unique name so that we don't overwrite
	zipPath := filepath.Join(dataDir, "notes_store.zip")
	n := 1
	for {
		if _, err := os.Stat(zipPath); os.IsNotExist(err) {
			break
		}
		name := fmt.Sprintf("notes_store-%d.zip", n)
		zipPath = filepath.Join(dataDir, name)
		n++
	}
	err := os.WriteFile(zipPath, zipData, 0644)
	if err != nil {
		logIfErrf(err, "maybeSaveUploadedZip: wrote zip to %s\n", zipPath)
	}
	logf("maybeSaveUploadedZip: wrote zip to %s\n", zipPath)
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

	maybeSaveUploadedZip(userInfo.DataDir, zipData)

	logf("handleStoreBulkUpload: replaying browser store zip with %d bytes\n", len(zipData))
	err = replayBrowserStoreZip(userInfo.DataDir, userInfo.Store, zipData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logf("handleStoreBulkUpload: replayed %d records\n", len(userInfo.Store.Records()))
	var rsp struct {
		Message string `json:"message"`
	}
	rsp.Message = fmt.Sprintf("Successfully uploaded %d records", len(userInfo.Store.Records()))
	serve200JSON(w, r, rsp)
}

func findPutRecord(recs []*appendstore.Record, key string) *appendstore.Record {
	// searching from the is faster bcause we're likely looking
	// for recent record
	for i := len(recs) - 1; i >= 0; i-- {
		rec := recs[i]
		if rec.Meta == key && rec.Kind == kStorePut {
			return rec
		}
	}
	return nil
}

func handleStoreGetString(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	key := r.FormValue("key")
	logf("handleStoreLoadLatestNoteContent: user %s, noteId: %s\n", userInfo.Email, key)
	if key == "" {
		http.Error(w, "Missing key", http.StatusBadRequest)
		return
	}
	recs := userInfo.Store.Records()
	rec := findPutRecord(recs, key)
	if rec == nil {
		http.Error(w, fmt.Sprintf("No content for key '%s'", key), http.StatusNotFound)
		return
	}
	content, err := userInfo.Store.ReadRecord(rec)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read content for key '%s': %s", key, err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(content)
	logf("handleStoreGetString: finished")
}

func handleStoreDeleteNote(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	noteId := r.FormValue("noteId")
	if noteId == "" {
		http.Error(w, "Missing or invalid noteId", http.StatusBadRequest)
		return
	}
	userInfo.Store.AppendRecord(kStoreDeleteNote, nil, noteId)
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
	userInfo.Store.AppendRecord(kStoreCreateNote, nil, meta)
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
	userInfo.Store.AppendRecord(kStoreSetNoteMeta, nil, meta)
	serve200JSON(w, r, map[string]string{
		"message": "Note meta set"})
}

// TODO: what to do if duplicate key?
func handleStoreWriteNoteContent(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	d, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	key := r.FormValue("key")
	if key == "" {
		http.Error(w, "Missing or invalid verId", http.StatusBadRequest)
		return
	}
	userInfo.Store.AppendRecord(kStorePut, d, key)
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
	if uri == "/api/store/getString" {
		handleStoreGetString(w, r, userInfo)
		return
	}
	if uri == "/api/store/putString" {
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
