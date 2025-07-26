package server

import (
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/dustin/go-humanize"
	"github.com/kjk/common/appendstore"
	"github.com/kjk/common/u"
)

func copyFileOverwrite(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	if err != nil {
		return err
	}

	return nil
}

func openStoreForTest() *appendstore.Store {
	dir := filepath.Join("data", "kkowalczyk@gmail.com")
	indexFileName := "index.txt"
	dataFileName := "data.bin"
	store := &appendstore.Store{
		DataDir:                    dir,
		IndexFileName:              indexFileName,
		DataFileName:               dataFileName,
		OverWriteDataExpandPercent: 100,
	}
	err := appendstore.OpenStore(store)
	must(err)
	err = validateStoreRecords(store)
	must(err)
	return store
}

func adHocTestOpenStore() *appendstore.Store {
	store := openStoreForTest()
	dumpRecords(store.AllRecords(), "")
	return store
}

func adHocTestReplyZip() {
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
		DataDir:                    dir,
		IndexFileName:              indexFileName,
		DataFileName:               dataFileName,
		OverWriteDataExpandPercent: 100,
	}
	err = appendstore.OpenStore(store)
	must(err)
	logf("store opened: %s\n", filepath.Join(store.DataDir, store.IndexFileName))
	err = replayBrowserStoreZip("", store, zipData, false)
	must(err)
}

func adHocTestReplayBrowserStoreZip() {
	dir := filepath.Join("data", "kkowalczyk@gmail.com")
	{
		srcPath := filepath.Join(dir, "index.txt")
		dstPath := filepath.Join(dir, "index_tmp.txt")
		copyFileOverwrite(srcPath, dstPath)
	}
	{
		srcPath := filepath.Join(dir, "data.bin")
		dstPath := filepath.Join(dir, "data_tmp.bin")
		copyFileOverwrite(srcPath, dstPath)
	}
	store := &appendstore.Store{
		DataDir:                    dir,
		IndexFileName:              "index_tmp.txt",
		DataFileName:               "data_tmp.bin",
		OverWriteDataExpandPercent: 100,
	}
	err := appendstore.OpenStore(store)
	must(err)
	zipPath := filepath.Join(dir, "notes_store-1.zip")
	zipData, err := os.ReadFile(zipPath)
	must(err)
	replayBrowserStoreZip(dir, store, zipData, true)
}

func adHocGetZipWithPutRecordsTest() {
	dir := filepath.Join("data", "kkowalczyk@gmail.com")
	store := &appendstore.Store{
		DataDir:       dir,
		IndexFileName: "index.txt",
		DataFileName:  "data.bin",
	}
	err := appendstore.OpenStore(store)
	must(err)
	zipData, err := getZipWithPutRecords(store, kStorePut)
	must(err)
	logf("getZipWithPutRecordsTest: zip size: %d\n", len(zipData))
}

func humanSize(n int) string {
	un := uint64(n)
	return humanize.Bytes(un)
}

func adHocTestCompress() {
	logf("testCompress()\n")
	rebuildFrontend()
	u.RunLoggedInDirMust(".", "bun", "run", "build")

	dir := filepath.Join("dist", "assets")
	files, err := os.ReadDir(dir)
	panicIfErr(err)
	var e fs.DirEntry
	for _, f := range files {
		if strings.HasPrefix(f.Name(), "index-") && strings.HasSuffix(f.Name(), ".js") {
			e = f
			break
		}
	}

	info, _ := e.Info()
	logf("found %s of size %d (%s)\n", e.Name(), info.Size(), humanSize(int(info.Size())))
	path := filepath.Join(dir, e.Name())
	benchFileCompress(path)
}

func adHocTestRunServerProd() {
	if !isWinOrMac() {
		logf("testRunServerProd: not running on Windows or Mac, skipping\n")
		return
	}
	logf("testRunServerProd\n")

	exeName := buildForProd(false)
	exeSize := u.FormatSize(u.FileSize(exeName))
	logf("created:\n%s %s\n", exeName, exeSize)

	cmd := exec.Command("./"+exeName, "-run-prod")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Start()
	must(err)

	u.WaitForSigIntOrKill()
	if cmd.ProcessState != nil && cmd.ProcessState.Exited() {
		logf("testRunServerProd: cmd already exited\n")
	} else {
		logf("testRunServerProd: killing cmd\n")
		err = cmd.Process.Kill()
		must(err)
	}
	logf("testRunServerProd: cmd killed\n")
}

func adHocTestGetNotes() {
	store := openStoreForTest()
	recs := store.Records()
	idToNote, err := idToNoteFromRecords(recs, false)
	must(err)
	for _, note := range idToNote {
		panicIf(len(note.versionIds) == 0, "note: %v has no versions\n", note)
	}
}
