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

func genUniqueNoteName(name string, nameToNote map[string]*Note) string {
	if n := nameToNote[name]; n == nil || n.isDeleted {
		return name
	}

	for i := 0; ; i++ {
		name := fmt.Sprintf("%s-%d", name, i)
		if _, ok := nameToNote[name]; !ok {
			return name
		}
	}
}

func replayBrowserStoreZip(userDataDir string, store *appendstore.Store, zipData []byte, isPartial bool) error {
	logf("replayBrowserStoreZip: replaying browser store zip with %d bytes, existing records: %d, isPartial: %t\n", len(zipData), len(store.Records()), isPartial)

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
	oldRecs := store.Records()
	idToNoteOld, err := idToNoteFromRecords(oldRecs, false)
	if err != nil {
		return fmt.Errorf("failed to read existing notes from store: %w", err)
	}
	nameToNoteOld := make(map[string]*Note)
	for _, note := range idToNoteOld {
		nameToNoteOld[note.name] = note
	}
	hasScratch := nameToNoteOld["scratch"] != nil
	hasInbox := nameToNoteOld["inbox"] != nil
	hasDailyNote := nameToNoteOld["daily journal"] != nil

	// key is id of note to ignore
	idToIgnoreNew := map[string]bool{}

	idToNoteNew, err := idToNoteFromRecords(newRecs, isPartial)
	if err != nil {
		return fmt.Errorf("failed to read new notes from store: %w", err)
	}
	nameToNoteMaybeDuplicatesNew := make(map[string]*Note)
	for _, note := range idToNoteNew {
		nameToNoteMaybeDuplicatesNew[note.name] = note
	}

	// don't modify map while traversing
	nonDups := make([]string, 0, len(nameToNoteMaybeDuplicatesNew))
	for name := range nameToNoteMaybeDuplicatesNew {
		if nameToNoteOld[name] == nil {
			push(&nonDups, name)
		}
	}
	for _, name := range nonDups {
		delete(nameToNoteMaybeDuplicatesNew, name)
	}
	// value is name
	idToRenameNew := map[string]string{}
	for name := range nameToNoteMaybeDuplicatesNew {
		newNote := nameToNoteMaybeDuplicatesNew[name]
		oldNote := nameToNoteOld[name]
		newLastVerId := sliceLastOrZero(newNote.versionIds)
		oldNoteVerId := sliceLastOrZero(oldNote.versionIds)
		if newLastVerId == "" {
			// shouldn't happen: new note has no versions
			idToIgnoreNew[newNote.id] = true
			continue
		}
		contentRecNew := findPutRecord(newRecs, newLastVerId)
		contentRecOld := findPutRecord(oldRecs, oldNoteVerId)
		if contentRecOld == nil {
			// shouldn't happen but ignore
			idToIgnoreNew[newNote.id] = true
			continue
		}
		newContent := data[contentRecNew.Offset : contentRecNew.Offset+contentRecNew.Size]
		oldContent, _ := store.ReadRecord(contentRecOld)
		if bytes.Equal(newContent, oldContent) {
			idToIgnoreNew[newNote.id] = true
			continue
		}
		// if content doesn't match, mark this note for renaming
		idToRenameNew[newNote.id] = name
	}

	for _, rec := range newRecs {
		switch rec.Kind {
		case kStoreCreateNote:
			// meta is "noteId:name"
			meta := rec.Meta
			parts := strings.SplitN(meta, ":", 2)
			id := parts[0]
			note := idToNoteOld[id]
			if note != nil {
				logf("replayBrowserStoreZip: note %s already exists, skipping create\n", meta)
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
				idToIgnoreNew[id] = true
				logf("replayBrowserStoreZip: note %s already exists, skipping create\n", meta)
				continue
			}
			if name, ok := idToRenameNew[id]; ok {
				newName := genUniqueNoteName(name, nameToNoteOld)
				logf("replayBrowserStoreZip: renaming note %s to %s\n", meta, newName)
				meta = fmt.Sprintf("%s:%s", id, newName)
				idToRenameNew[id] = newName // remember so that we can handle kStoreSetNoteMeta
			}
			store.AppendRecordWithTimestamp(kStoreCreateNote, meta, nil, rec.TimestampMs)
			idToNoteOld[id] = &Note{
				id:        id,
				name:      name,
				createdAt: rec.TimestampMs,
			}
			logf("replayBrowserStoreZip: created note %s with name %s\n", id, parts[1])
		case kStoreSetNoteMeta:
			var noteMeta NoteMeta
			// meta is JSON serialized note metadata
			meta := []byte(rec.Meta)
			err := json.Unmarshal(meta, &noteMeta)
			if err != nil {
				logErrorf("replayBrowserStoreZip: applyMetadata: failed to unmarshal note meta: %s, err: %s\n", meta, err)
				return err
			}
			id := noteMeta.Id
			if idToIgnoreNew[id] {
				logf("replayBrowserStoreZip: note %s already exists, skipping meta update\n", id)
				continue
			}
			note := idToNoteOld[id]
			if note == nil {
				logf("replayBrowserStoreZip: note %s does not exist, skipping meta update\n", noteMeta.Id)
				continue
			}
			if newName, ok := idToRenameNew[id]; ok {
				if noteMeta.Name != newName {
					noteMeta.Name = newName
					meta, _ = json.Marshal(noteMeta)
				}
			}
			store.AppendRecordWithTimestamp(kStoreSetNoteMeta, string(meta), nil, rec.TimestampMs)
			logf("replayBrowserStoreZip: updated meta for note %s: %+v\n", id, noteMeta)

		case kStoreDeleteNote:
			id := rec.Meta
			if idToIgnoreNew[id] {
				logf("replayBrowserStoreZip: note %s already exists, skipping meta update\n", id)
				continue
			}

			note := idToNoteOld[id]
			if note == nil {
				logf("replayBrowserStoreZip: note %s does not exist, skipping delete\n", id)
				continue
			}
			if note.isDeleted {
				logf("replayBrowserStoreZip: note %s is already deleted, skipping delete\n", id)
				continue
			}
			store.AppendRecordWithTimestamp(kStoreDeleteNote, id, nil, rec.TimestampMs)
			note.isDeleted = true
			// logf("replayBrowserStoreZip: deleted note %s\n", noteId)

		case kStorePut, kStorePutEncrypted:
			verId := rec.Meta // verId is id:verId
			id := strings.SplitN(rec.Meta, ":", 2)[0]
			if idToIgnoreNew[id] {
				logf("replayBrowserStoreZip: note %s already exists, skipping meta update\n", id)
				continue
			}
			note := idToNoteOld[id]
			if note == nil {
				logf("replayBrowserStoreZip: note %s does not exist, skipping content update\n", id)
				continue
			}
			if note.isDeleted {
				logf("replayBrowserStoreZip:note %s is deleted, skipping content update\n", id)
				continue
			}
			content := data[rec.Offset : rec.Offset+rec.Size]
			store.AppendRecordWithTimestamp(rec.Kind, verId, content, rec.TimestampMs)
		// logf("replayBrowserStoreZip: updated content for note %s with verId %s\n", noteId, verId)
		case kStoreWriteFile:
			content := data[rec.Offset : rec.Offset+rec.Size]
			store.AppendRecordFileWithTimestamp(kStoreWriteFile, rec.Meta, content, rec.Meta, rec.TimestampMs)
			// logf("replayBrowserStoreZip: updated content for note %s with verId %s\n", noteId, verId)
		default:
			logf("replayBrowserStoreZip: unknown record kind %s\n", rec.Kind)
			return fmt.Errorf("unknown record kind %s", rec.Kind)
		}
	}
	logf("replayBrowserStoreZip: replayed %d records\n", len(newRecs))
	if err := validateStoreRecords(store); err != nil {
		return err
	}
	return nil
}

func validateStoreRecordsLog(store *appendstore.Store) {
	err := validateStoreRecords(store)
	if err != nil {
		logf("validateStoreRecords: failed with %s\n", err)
	}
}

func validateStoreRecords(store *appendstore.Store) error {
	dataPath := filepath.Join(store.DataDir, store.DataFileName)
	dataSize := int64(0)
	if st, err := os.Stat(dataPath); os.IsNotExist(err) {
		return fmt.Errorf("data file does not exist: %s", dataPath)
	} else {
		dataSize = st.Size()
	}

	noteToWatch := "BlCJ"
	noteToWatch = ""
	recs := store.Records()
	idToNote := make(map[string]*Note)
	for _, rec := range recs {
		k := rec.Kind
		recStr := serializeRecord(rec)
		if noteToWatch != "" && strings.Contains(recStr, noteToWatch) {
			logf("%s", recStr)
		}
		switch k {
		case kStorePut, kStorePutEncrypted, kStoreWriteFile:
			size := rec.Size
			end := rec.Offset + size
			if end > dataSize {
				return fmt.Errorf("record %s has invalid offset/size: offset=%d, size=%d, end: %d, data size=%d\n%s",
					rec.Meta, rec.Offset, size, end, dataSize, recStr)
			}
		}
		switch k {
		case kStorePut:
		// do nothing
		case kStorePutEncrypted:
		// do nothing
		case kStoreWriteFile:
		// do nothing
		case kStoreCreateNote:
			parts := strings.SplitN(rec.Meta, ":", 2)
			id := parts[0]
			name := parts[1]
			if _, ok := idToNote[id]; ok {
				return fmt.Errorf("duplicate note id %s\n%s", id, recStr)
			}
			idToNote[id] = &Note{id: id, name: name, createdAt: rec.TimestampMs}
		case kStoreDeleteNote:
			id := rec.Meta
			if note, ok := idToNote[id]; !ok {
				return fmt.Errorf("%s: note id '%s' not found\n%s", kStoreDeleteNote, id, recStr)
			} else {
				note.isDeleted = true
			}
		case kStoreSetNoteMeta:
			id := rec.Meta
			if _, ok := idToNote[id]; ok {
				return fmt.Errorf("duplicate note id %s\n%s", id, recStr)
			} else {
				// validate meta
			}
		default:
			return fmt.Errorf("unknown record kind %s\n%s", rec.Kind, recStr)
		}
	}
	return nil
}
