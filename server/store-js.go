package server

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/kjk/common/appendstore"
)

func replayBrowserStoreZip(userDataDir string, store *appendstore.Store, zipData []byte) error {
	logf("replayBrowserStoreZip: replaying browser store zip with %d bytes\n", len(zipData))

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

	var index, data []byte
	for _, file := range zipReader.File {
		switch file.Name {
		case "index.txt":
			index = extractFile(file)
		case "data.bin":
			data = extractFile(file)
		default:
			if strings.HasPrefix(file.Name, "file:") {
				d := extractFile(file)
				fileName := strings.TrimPrefix(file.Name, "file:")
				path := filepath.Join(userDataDir, ToValidFileName(fileName))
				os.WriteFile(path, d, 0644)
				logf("replayBrowserStoreZip: saved file %s (%d bytes)\n", path, len(d))
			}
		}
	}

	if index == nil || data == nil {
		return errors.New("zip file must contain index.txt and data.bin")
	}

	maybeSaveIndexAndData(userDataDir, index, data)

	logf("replayBrowserStoreZip: index size %d, data size %d\n", len(index), len(data))
	newRecs, err := appendstore.ParseIndexFromData(index)
	if err != nil {
		return err
	}
	logf("replayBrowserStoreZip: replaying %d records from browser store\n", len(newRecs))
	// validate records
	dataSize := int64(len(data))
	for _, rec := range newRecs {
		end := rec.Offset + rec.Size
		if end > dataSize {
			return fmt.Errorf("record %v has invalid offset/size: offset=%d, size=%d, data size=%d",
				rec, rec.Offset, rec.Size, dataSize)
		}
	}
	recs := store.Records()
	notes, err := notesFromStoreLog(recs)
	if err != nil {
		return fmt.Errorf("failed to read existing notes from store: %w", err)
	}
	var hasScratch, hasInbox, hasDailyNote bool
	for _, note := range notes {
		switch note.name {
		case "scratch":
			hasScratch = true
		case "inbox":
			hasInbox = true
		case "daily journal":
			hasDailyNote = true
		}
	}

	// key is id of note to ignore
	ignoreNotes := map[string]bool{}
	for _, rec := range newRecs {
		switch rec.Kind {
		case kStoreCreateNote:
			// meta is "noteId:name"
			parts := strings.SplitN(rec.Meta, ":", 2)
			id := parts[0]
			note := notes[id]
			if note != nil {
				logf("replayBrowserStoreZip: note %s already exists, skipping create\n", id)
				continue
			}
			name := parts[1]
			ignore := hasScratch && name == "scratch"
			if hasInbox && name == "inbox" {
				ignore = true
			}
			if hasDailyNote && name == "daily journal" {
				ignore = true
			}
			if ignore {
				ignoreNotes[id] = true
				logf("replayBrowserStoreZip: note %s already exists, skipping create\n", id)
				continue
			}
			store.AppendRecord(kStoreCreateNote, nil, rec.Meta)
			notes[id] = &NoteInfo{
				id:        id,
				name:      name,
				createdAt: rec.TimestampMs,
			}
			logf("replayBrowserStoreZip: created note %s with name %s\n", id, parts[1])
		case kStoreSetNoteMeta:
			var noteMeta NoteMeta
			meta := rec.Meta
			err := json.Unmarshal([]byte(meta), &noteMeta)
			if err != nil {
				logErrorf("replayBrowserStoreZip: applyMetadata: failed to unmarshal note meta: %s, err: %s\n", meta, err)
				return err
			}
			id := noteMeta.Id
			if ignoreNotes[id] {
				logf("replayBrowserStoreZip: note %s already exists, skipping meta update\n", id)
				continue
			}
			note := notes[id]
			if note == nil {
				logf("replayBrowserStoreZip: note %s does not exist, skipping meta update\n", noteMeta.Id)
				continue
			}
			store.AppendRecord(kStoreSetNoteMeta, nil, rec.Meta)
			logf("replayBrowserStoreZip: updated meta for note %s: %+v\n", id, noteMeta)

		case kStoreDeleteNote:
			id := rec.Meta
			if ignoreNotes[id] {
				logf("replayBrowserStoreZip: note %s already exists, skipping meta update\n", id)
				continue
			}

			note := notes[id]
			if note == nil {
				logf("replayBrowserStoreZip: note %s does not exist, skipping delete\n", id)
				continue
			}
			if note.isDeleted {
				logf("replayBrowserStoreZip: note %s is already deleted, skipping delete\n", id)
				continue
			}
			store.AppendRecord(kStoreDeleteNote, nil, id)
			note.isDeleted = true
			// logf("replayBrowserStoreZip: deleted note %s\n", noteId)

		case kStorePut:
			verId := rec.Meta // verId is id:verId
			id := strings.SplitN(rec.Meta, ":", 2)[0]
			if ignoreNotes[id] {
				logf("replayBrowserStoreZip: note %s already exists, skipping meta update\n", id)
				continue
			}
			note := notes[id]
			if note == nil {
				logf("replayBrowserStoreZip: note %s does not exist, skipping content update\n", id)
				continue
			}
			if note.isDeleted {
				logf("replayBrowserStoreZip:note %s is deleted, skipping content update\n", id)
				continue
			}
			content := data[rec.Offset : rec.Offset+rec.Size]
			store.AppendRecord(kStorePut, content, verId)
			// logf("replayBrowserStoreZip: updated content for note %s with verId %s\n", noteId, verId)
		}
	}
	logf("replayBrowserStoreZip: replayed %d records\n", len(newRecs))
	return nil
}

func testReplyZipAdHoc() {
	dir := filepath.Join("data", "kkowalczyk@gmail.com")
	zipName := "notes_store.zip"
	zipPath := filepath.Join(dir, zipName)
	zipData, err := os.ReadFile(zipPath)
	if err != nil {
		logf("zip file %s does not exist, skipping test\n", zipPath)
		return
	}
	indexFileName := "reply_browser_index.txt"
	dataFileName := "reply_browser_data.bin"
	os.Remove(filepath.Join(dir, indexFileName))
	os.Remove(filepath.Join(dir, dataFileName))
	store := &appendstore.Store{
		DataDir:       dir,
		IndexFileName: indexFileName,
		DataFileName:  dataFileName,
	}
	err = appendstore.OpenStore(store)
	must(err)
	logf("store opened: %s\n", filepath.Join(store.DataDir, store.IndexFileName))
	err = replayBrowserStoreZip("", store, zipData)
	must(err)
}
