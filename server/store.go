package server

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kjk/common/appendstore"
)

type UserInfo struct {
	User    string
	Email   string
	Store   *appendstore.Store
	DataDir string

	logInData *logInData
	mu        sync.Mutex
}

func (u *UserInfo) Lock() {
	u.mu.Lock()
}

func (u *UserInfo) Unlock() {
	u.mu.Unlock()
}

var (
	users []*UserInfo

	muStore sync.Mutex
)

func serve404(w http.ResponseWriter, s string) {
	http.Error(w, s, http.StatusNotFound)
}

type GetNotesResponse struct {
	Ver          int
	LastChangeID int
	NotesCompact [][]any
}

const kNoteFlagIsStarred = 0x01
const kNoteFlagIsArchived = 0x02

// must match store-local.js
const kStoreCreateNote = "note-create"
const kStoreDeleteNote = "note-delete"
const kStoreSetNoteMeta = "note-meta"
const kStorePut = "put"
const kStoreWriteFile = "write-file"

type Note struct {
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

func applyMetadata(ni *Note, noteMeta *NoteMeta) error {
	ni.name = noteMeta.Name
	ni.isArchived = noteMeta.IsArchived
	ni.isStarred = noteMeta.IsStarred
	ni.altShortcut = noteMeta.AltShortcut
	return nil
}

func notesFromRedords(records []*appendstore.Record) ([]*Note, error) {
	idToNote, err := idToNoteFromRecords(records, false)
	if err != nil {
		return nil, err
	}
	return slices.Collect(maps.Values(idToNote)), nil
}

func idToNoteFromRecords(records []*appendstore.Record, isPartial bool) (map[string]*Note, error) {
	logf("notesFromStoreLog: processing %d records\n", len(records))
	idToNote := make(map[string]*Note)
	for _, rec := range records {
		switch rec.Kind {
		case kStoreCreateNote:
			// meta is "noteId:name"
			parts := strings.SplitN(rec.Meta, ":", 2)
			id := parts[0]
			name := parts[1]
			ni := &Note{
				id:        id,
				name:      name,
				createdAt: rec.TimestampMs,
			}
			if idToNote[id] != nil {
				logf("note with id %s already exists", id)
				return nil, fmt.Errorf("kStoreCreateNote: note with id %s already exists", id)
			}
			idToNote[id] = ni
		case kStoreSetNoteMeta:
			var noteMeta NoteMeta
			meta := rec.Meta
			err := json.Unmarshal([]byte(meta), &noteMeta)
			if err != nil {
				logErrorf("kStoreSetNoteMeta: failed to unmarshal note meta: %s, err: %s\n", meta, err)
				return nil, err
			}
			id := noteMeta.Id
			note := idToNote[id]
			if note == nil {
				if isPartial {
					continue
				}
				logf("note %s does not exist, skipping meta update\n", id)
				return nil, fmt.Errorf("kStoreSetNoteMeta: note %s does not exist", id)
			}
			if note.isDeleted {
				logf("note %s is deleted, skipping meta update\n", id)
				return nil, fmt.Errorf("kStoreSetNoteMeta: note %s is deleted", id)
			}
			if noteMeta.AltShortcut != "" {
				for _, n := range idToNote {
					if n.altShortcut == noteMeta.AltShortcut {
						n.altShortcut = ""
					}
				}
				note.altShortcut = noteMeta.AltShortcut
			}
			applyMetadata(note, &noteMeta)
			note.modifiedAt = rec.TimestampMs
		case kStoreDeleteNote:
			id := rec.Meta
			note := idToNote[id]
			if note == nil {
				if isPartial {
					continue
				}
				logf("note %s does not exist, skipping delete\n", id)
				return nil, fmt.Errorf("kStoreDeleteNote: note %s does not exist", id)
			}
			if note.isDeleted {
				logf("note %s is deleted, skipping delete\n", id)
				return nil, fmt.Errorf("kStoreDeleteNote: note %s is deleted", id)
			}
			note.isDeleted = true
		case kStorePut:
			verId := rec.Meta // verId is id:verId
			id := strings.SplitN(rec.Meta, ":", 2)[0]
			note := idToNote[id]
			if note == nil {
				if isPartial {
					continue
				}
				logf("note %s does not exist, skipping put\n", id)
				return nil, fmt.Errorf("kStorePut: note %s does not exist", id)
			}
			if note.isDeleted {
				logf("note %s is deleted, skipping put\n", id)
				return nil, fmt.Errorf("kStorePut: note %s is deleted", id)
			}
			note.versionIds = append(note.versionIds, verId)
		case kStoreWriteFile:
			// do nothing
		default:
			logf("unknown operation %d\n", rec.Kind)
			return nil, fmt.Errorf("unknown operation %s", rec.Kind)
		}
	}

	return idToNote, nil
}

type GetMultiRequest struct {
	VerIDs []string
}

func serializeRecord(rec *appendstore.Record) string {
	sz := ""
	if rec.SizeInFile > 0 {
		sz = fmt.Sprintf("%d:%d", rec.Size, rec.SizeInFile)
	} else {
		sz = fmt.Sprintf("%d", rec.Size)
	}
	overWritten := ""
	if rec.Overwritten {
		overWritten = " :overwritten"
	}
	return fmt.Sprintf("%d %s %s %s%s\n", rec.Offset, sz, rec.Kind, rec.Meta, overWritten)
}

func dumpRecords(recs []*appendstore.Record, limitKind string) {
	type row struct {
		offset      string
		size        string
		kind        string
		meta        string
		overwritten string
	}

	var rows []row
	for _, rec := range recs {
		if limitKind != "" && rec.Kind != limitKind {
			continue
		}
		sz := ""
		if rec.SizeInFile > 0 {
			sz = fmt.Sprintf("%d:%d", rec.Size, rec.SizeInFile)
		} else {
			sz = fmt.Sprintf("%d", rec.Size)
		}
		overWritten := ""
		if rec.Overwritten {
			overWritten = "overwritten"
		}
		rows = append(rows, row{
			offset:      fmt.Sprintf("%d", rec.Offset),
			size:        sz,
			kind:        rec.Kind,
			meta:        rec.Meta,
			overwritten: overWritten,
		})
	}

	if len(rows) == 0 {
		return
	}

	maxOffset := len("Offset")
	maxSize := len("Size")
	maxKind := len("Kind")
	maxMeta := len("Meta")
	maxOverwritten := len("Overwritten")

	for _, r := range rows {
		if len(r.offset) > maxOffset {
			maxOffset = len(r.offset)
		}
		if len(r.size) > maxSize {
			maxSize = len(r.size)
		}
		if len(r.kind) > maxKind {
			maxKind = len(r.kind)
		}
		if len(r.meta) > maxMeta {
			maxMeta = len(r.meta)
		}
		if len(r.overwritten) > maxOverwritten {
			maxOverwritten = len(r.overwritten)
		}
	}

	format := fmt.Sprintf("%%-%ds | %%-%ds | %%-%ds | %%-%ds | %%-%ds\n", maxOffset, maxSize, maxKind, maxMeta, maxOverwritten)

	fmt.Printf(format, "Offset", "Size", "Kind", "Meta", "Overwritten")
	fmt.Println(strings.Repeat("-", maxOffset+maxSize+maxKind+maxMeta+maxOverwritten+8)) // 4 pipes and 4 spaces

	for _, r := range rows {
		fmt.Printf(format, r.offset, r.size, r.kind, r.meta, r.overwritten)
	}
}

func dumpPutRecords(recs []*appendstore.Record) {
	dumpRecords(recs, kStorePut)
}

func findPutRecord(recs []*appendstore.Record, key string) *appendstore.Record {
	// searching from the is faster bcause we're likely looking
	// for recent record
	for _, rec := range slices.Backward(recs) {
		if rec.Meta == key && rec.Kind == kStorePut {
			return rec
		}
	}
	return nil
}

// POST /api/store/getNotesMultiContent
func handleStoreGetNotesMultiContent(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	logf("handleStoreGetNotesMultiContent: user %s\n", userInfo.Email)
	jsonData, err := io.ReadAll(r.Body)
	if serve500TextIfError(w, err, "handleStoreGetNotesMultiContent: failed to read request body: %v", err) {
		return
	}
	var req GetMultiRequest
	err = json.Unmarshal(jsonData, &req)
	if serve500TextIfError(w, err, "handleStoreGetNotesMultiContent: failed to unmarshal request body\n%s\n error: %v", string(jsonData), err) {
		return
	}
	if len(req.VerIDs) == 0 {
		serve400Text(w, fmt.Sprintf("no note ids provided in JSON: '%s'", string(jsonData)))
		return
	}
	store := userInfo.Store
	buf := bytes.Buffer{}
	zipFile := zip.NewWriter(&buf)
	recs := store.Records()
	for _, verID := range req.VerIDs {
		rec := findPutRecord(recs, verID)
		if rec == nil {
			dumpPutRecords(recs)
			serve404Text(w, "version %s does not exist", verID)
			return
		}
		d, err := store.ReadRecord(rec)
		if err != nil {
			serve500Text(w, "failed to get note content %s: %v", verID, err)
			return
		}
		header := &zip.FileHeader{
			Name:   verID,
			Method: zip.Deflate,
		}
		zipWriter, err := zipFile.CreateHeader(header)
		if err != nil {
			serve500Text(w, "failed to create zip file entry for %s: %v", verID, err)
			return
		}
		if _, err := zipWriter.Write(d); err != nil {
			serve500Text(w, "failed to write note content %s to zip file: %v", verID, err)
			return
		}
	}
	if err := zipFile.Close(); err != nil {
		serve500Text(w, "failed to close zip file, error: %v", err)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.WriteHeader(http.StatusOK)
	w.Write(buf.Bytes())
	logf("handleStoreGetNotesMultiContent: returned %d files\n", len(req.VerIDs))
}

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

	notes, err := notesFromRedords(recs)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to get notes: %s", err), http.StatusInternalServerError)
		return
	}
	notesCompact := make([][]any, 0, len(notes))

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
		nc := []any{
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
	serve200JSON(w, rsp)
}

func maybeSaveIndexAndData(dataDir string, index []byte, data []byte) {
	if !isDev() || dataDir == "" {
		// only when testing
		return
	}
	os.MkdirAll(dataDir, 0755)
	path := filepath.Join(dataDir, "notes_store_index.txt")
	os.WriteFile(path, index, 0644)
	path = filepath.Join(dataDir, "notes_store_data.bin")
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

// POST /api/store/uploadOfflineChanges
func handleStoreUploadOfflineChanges(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	// it's the same implementation. might be different at some point?
	handleStoreBulkUpload(w, r, userInfo)
}

// POST /api/store/bulkUpload
func handleStoreBulkUpload(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	if !verifyPOSTRequest(w, r) {
		return
	}

	zipData, err := io.ReadAll(r.Body)
	if err != nil {
		logf("handleStoreBulkUpload: failed to read request body, error: %v", err)
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	logf("handleStoreBulkUpload: user %s, zip size: %d\n", userInfo.Email, len(zipData))

	maybeSaveUploadedZip(userInfo.DataDir, zipData)

	err = replayBrowserStoreZip(userInfo.DataDir, userInfo.Store, zipData, false)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	logf("handleStoreBulkUpload: after replaying we have %d records\n", len(userInfo.Store.Records()))
	var rsp struct {
		Message string `json:"message"`
	}
	rsp.Message = fmt.Sprintf("Successfully uploaded %d records", len(userInfo.Store.Records()))
	serve200JSON(w, rsp)
}

// POST /api/store/get?key=<key>
func handleStoreGet(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	key := r.FormValue("key")
	logf("handleStoreGetString: user %s, key: %s\n", userInfo.Email, key)
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
	logf("handleStoreGetString: key: %s rec: %d %d %s %s\n", key, rec.Offset, rec.Size, rec.Kind, rec.Meta)
	content, err := userInfo.Store.ReadRecord(rec)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to read content for key '%s': %s", key, err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(content)
	logf("handleStoreGetString: finished\n")
}

// GET /api/store/deleteNote?noteId=<id>
func handleStoreDeleteNote(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	noteId := r.FormValue("noteId")
	if noteId == "" {
		http.Error(w, "Missing or invalid noteId", http.StatusBadRequest)
		return
	}
	userInfo.Store.AppendRecord(kStoreDeleteNote, noteId, nil)
	serve200JSON(w, map[string]string{
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
	userInfo.Store.AppendRecord(kStoreCreateNote, meta, nil)
	serve200JSON(w, map[string]string{
		"message": "Note created"})
}

func handleStoreWriteNoteMeta(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	meta := r.FormValue("meta")
	if meta == "" {
		http.Error(w, "Missing or invalid meta", http.StatusBadRequest)
		return
	}
	// TODO: verify meta is valid JSON
	userInfo.Store.AppendRecord(kStoreSetNoteMeta, meta, nil)
	serve200JSON(w, map[string]string{
		"message": "Note meta set"})
}

// POST /api/store/put?key=<key>
func handleStorePut(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
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
	userInfo.Store.AppendRecord(kStorePut, key, d)
	serve200JSON(w, map[string]string{
		"message": "Note content written successfully"})
}

// GET /api/store/readFile?name=<fileName>
func handleStoreReadFile(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Missing or invalid name", http.StatusBadRequest)
		return
	}
	path := filepath.Join(userInfo.DataDir, ToValidFileName(name))
	d, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, fmt.Sprintf("File %s does not exist", name), http.StatusNotFound)
			return
		}
		http.Error(w, fmt.Sprintf("Failed to read file %s: %s", name, err), http.StatusInternalServerError)
		return
	}
	logf("handleStoreReadFile: user %s, fileName: %s, size: %d\n", userInfo.Email, name, len(d))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(d)
}

// POST /api/store/writeFile?name=<fileName>
func handleStoreWriteFile(w http.ResponseWriter, r *http.Request, userInfo *UserInfo) {
	d, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Missing or invalid name", http.StatusBadRequest)
		return
	}
	meta, _ := json.Marshal(map[string]string{
		"name": name,
	})
	if err := userInfo.Store.OverwriteRecord(kStoreWriteFile, string(meta), d); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write file %s: %s", name, err), http.StatusInternalServerError)
		return
	}

	serve200JSON(w, map[string]string{
		"message": fmt.Sprintf("File %s content written successfully", name)})
}

func handleStore(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	userInfo, err := getLoggedUser(r, w)
	if serve500TextIfError(w, err, "handleStore: %s, err: %v", uri, err) {
		return
	}
	logf("handleStore: %s, userEmail: %s\n", uri, userInfo.Email)

	// serialize user operations. I could try to be more fine-grained
	// but this is safe and simple
	userInfo.mu.Lock()
	defer userInfo.mu.Unlock()

	if uri == "/api/store/get" {
		handleStoreGet(w, r, userInfo)
		return
	}
	if uri == "/api/store/put" {
		handleStorePut(w, r, userInfo)
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
	if uri == "/api/store/writeFile" {
		handleStoreWriteFile(w, r, userInfo)
		return
	}
	if uri == "/api/store/readFile" {
		handleStoreReadFile(w, r, userInfo)
		return
	}

	if uri == "/api/store/bulkUpload" {
		handleStoreBulkUpload(w, r, userInfo)
		return
	}
	if uri == "/api/store/uploadOfflineChanges" {
		handleStoreUploadOfflineChanges(w, r, userInfo)
		return
	}
	if uri == "/api/store/getNotes" {
		handleStoreGetNotes(w, r, userInfo)
		return
	}
	if uri == "/api/store/getNotesMultiContent" {
		handleStoreGetNotesMultiContent(w, r, userInfo)
		return
	}

	serve404(w, "Unknown store operation: "+uri)
}

type updateFromUser struct {
	UserInfo  *UserInfo
	Type      string
	SessionID string
}

var (
	chUpdateFromUser = make(chan *updateFromUser)
)

func notifyAboutNotesUpdates(user *UserInfo, sessionID string) {
	chUpdateFromUser <- &updateFromUser{
		UserInfo:  user,
		Type:      "notes-updated",
		SessionID: sessionID,
	}
}

// SSE /api/events?sessionId=<sessionId>
func handleEvents(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	userInfo, err := getLoggedUser(r, w)
	if serve500TextIfError(w, err, "handleStore: %s, err: %v", uri, err) {
		return
	}
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		http.Error(w, "sessionId is required", http.StatusBadRequest)
		return
	}
	logf("handleEvents: userEmail: %s, sessionId: %s\n", userInfo.Email, sessionID)

	// Set required headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*") // Optional: Allow cross-origin if needed

	// Get the flusher to send data immediately
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}
	for {
		select {
		case update := <-chUpdateFromUser:
			// notify this user about changes made from other browser sessions
			// so that they can update their cached notes
			if update.UserInfo.Email == userInfo.Email {
				// don't send if update came from ourselves
				if update.SessionID != sessionID {
					_, err = fmt.Fprintf(w, "data: %s\n\n", update.Type)
				}
			}
		case <-time.After(5 * time.Second):
			// wake up every 5 seconds, write a ping to keep alive
			// and detect broken connection
			_, err = fmt.Fprint(w, "data: ping\n\n")
		}
		if err != nil {
			break
		}
		flusher.Flush()
	}
}
