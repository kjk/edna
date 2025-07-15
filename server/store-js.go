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
		}
	}

	if index == nil || data == nil {
		return errors.New("zip file must contain index.txt and data.bin")
	}

	maybeSaveIndexAndData(userDataDir, index, data)

	logf("replayBrowserStoreZip: index size %d, data size %d\n", len(index), len(data))
	recs, err := appendstore.ParseIndexFromData(index)
	if err != nil {
		return err
	}
	logf("replaying %d records from browser store\n", len(recs))
	// validate records
	dataSize := int64(len(data))
	for _, rec := range recs {
		end := rec.Offset + rec.Size
		if end > dataSize {
			return fmt.Errorf("record %v has invalid offset/size: offset=%d, size=%d, data size=%d",
				rec, rec.Offset, rec.Size, dataSize)
		}
	}

	notes, err := notesFromStoreLog(store.Records())
	if err != nil {
		return fmt.Errorf("failed to read existing notes from store: %w", err)
	}
	for _, rec := range recs {
		switch rec.Kind {
		case kStoreCreateNote:
			// meta is "noteId:name"
			parts := strings.SplitN(rec.Meta, ":", 2)
			id := parts[0]
			note := notes[id]
			if note != nil {
				logf("note %s already exists, skipping create\n", id)
				continue
			}
			store.AppendRecord(kStoreCreateNote, nil, rec.Meta)
			notes[id] = &NoteInfo{
				id:        id,
				name:      parts[1],
				createdAt: rec.TimestampMs,
			}
			logf("created note %s with name %s\n", id, parts[1])
		case kStoreSetNoteMeta:
			var noteMeta NoteMeta
			meta := rec.Meta
			err := json.Unmarshal([]byte(meta), &noteMeta)
			if err != nil {
				logErrorf("applyMetadata: failed to unmarshal note meta: %s, err: %s\n", meta, err)
				return err
			}
			note := notes[noteMeta.Id]
			if note == nil {
				logf("note %s does not exist, skipping meta update\n", noteMeta.Id)
				continue
			}
			store.AppendRecord(kStoreSetNoteMeta, nil, rec.Meta)
			logf("updated meta for note %s: %+v\n", noteMeta.Id, noteMeta)

		case kStoreDeleteNote:
			noteId := rec.Meta
			note := notes[noteId]
			if note == nil {
				logf("note %s does not exist, skipping delete\n", noteId)
				continue
			}
			if note.isDeleted {
				logf("note %s is already deleted, skipping delete\n", noteId)
				continue
			}
			store.AppendRecord(kStoreDeleteNote, nil, noteId)
			note.isDeleted = true
			logf("deleted note %s\n", noteId)

		case kStorePut:
			verId := rec.Meta // verId is noteId:verId
			noteId := strings.SplitN(rec.Meta, ":", 2)[0]
			note := notes[noteId]
			if note == nil {
				logf("note %s does not exist, skipping content update\n", noteId)
				continue
			}
			if note.isDeleted {
				logf("note %s is deleted, skipping content update\n", noteId)
				continue
			}
			content := data[rec.Offset : rec.Offset+rec.Size]
			store.AppendRecord(kStorePut, content, verId)
			logf("updated content for note %s with verId %s\n", noteId, verId)
		}
	}
	logf("replayBrowserStoreZip: replayed %d records\n", len(recs))
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
