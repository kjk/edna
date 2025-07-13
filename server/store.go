package server

import (
	"archive/zip"
	"bytes"
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
		userInfo = &UserInfo{
			Email: cookie.Email,
			User:  cookie.User,
		}

		dataDir := getDataDirMust()
		// TODO: must escape email to avoid chars not allowed in file names
		dataDir = filepath.Join(dataDir, email)
		userInfo.Store = &appendstore.Store{
			DataDir:       dataDir,
			IndexFileName: "index.txt",
			DataFileName:  "data.bin",
		}
		err := appendstore.OpenStore(userInfo.Store)
		if err != nil {
			logf("getLoggedUser(): failed to open store for user %s, err: %s\n", email, err)
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
	if uri == "/api/store/bulkUpload" {
		handleStoreBulkUpload(w, r, userInfo)
		return
	}
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
