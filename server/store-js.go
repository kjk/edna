package server

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/kjk/common/appendstore"
)

// implements parsing of the appendstore.js index and data files

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
			return nil, fmt.Errorf("invalid index line: %s", line)
		}

		offset, err := strconv.ParseInt(parts[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid offset in index line: %s", line)
		}

		size, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid size in index line: %s", line)
		}

		timeInMs, err := strconv.ParseInt(parts[2], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid time in index line: %s", line)
		}

		kind := parts[3]
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

func replayBrowserStore(store *appendstore.Store, index []byte, data []byte) error {
	recs, err := parseIndex(string(index))
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

	return nil
}

func replayBrowserStoreZip(store *appendstore.Store, zipData []byte) error {
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
		case "index.txt":
			indexData = extractFile(file)
		case "data.bin":
			dataData = extractFile(file)
		}
	}

	if indexData == nil || dataData == nil {
		return errors.New("zip file must contain notes_store_index.txt and notes_store_data.bin")
	}

	err = replayBrowserStore(store, indexData, dataData)
	return err
}

func testReplyZipAdHoc() {
	dir := "data"
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
	err = replayBrowserStoreZip(store, zipData)
	must(err)
}
