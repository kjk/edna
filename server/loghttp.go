package server

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/kjk/common/httplogger"
	"github.com/kjk/minioutil"
)

var (
	httpLogger *httplogger.File
)

func logHTTPReq(r *http.Request, code int, size int64, dur time.Duration) {
	if strings.HasPrefix(r.URL.Path, "/ping") {
		return
	}
	if code >= 400 {
		// make 400 stand out more in logs
		logf("%s %d %s %s in %s\n", "   ", code, r.RequestURI, formatSize(size), dur)
	} else {
		logf("%s %d %s %s in %s\n", r.Method, code, r.RequestURI, formatSize(size), dur)
	}

	if code >= 300 && code < 400 {
		// no need to log redirects
		return
	}

	err := httpLogger.LogReq(r, code, size, dur)
	if err != nil {
		logErrorf("httpLogger.LogReq() failed with '%s'\n", err)
	}
}

// upload httplog-2021-10-06_01.txt as
// apps/${app}/httplog/2021/10-06/2021-10-06_01.txt.br
func uploadCompressedHTTPLog(app, path string) {
	timeStart := time.Now()
	mc := newMinioSpacesClient()
	remotePath := httplogger.RemotePathFromFilePath(app, path)
	if remotePath == "" {
		logf("uploadCompressedHTTPLog: remotePathFromFilePath() failed for '%s'\n", path)
		return
	}
	remotePath += ".br"
	_, err := mc.UploadFileBrotliCompressed(remotePath, path, true)
	if err != nil {
		logErrorf("uploadCompressedHTTPLog: minioUploadFilePublic() failed with '%s'\n", err)
		return
	}
	logf("uploadCompressedHTTPLog: uploaded '%s' as '%s' in %s\n", path, remotePath, time.Since(timeStart))
}

func OpenHTTPLog(app string) func() {
	panicIf(app == "")
	dir := "logs"
	must(os.MkdirAll(dir, 0755))

	didRotate := func(path string) {
		canUpload := hasSpacesCreds() && !isWinOrMac()
		logf("didRotateHTTPLog: '%s', hasSpacesCreds: %v\n", path, canUpload)
		if !canUpload {
			return
		}
		go uploadCompressedHTTPLog(app, path)
	}
	var err error
	httpLogger, err = httplogger.New(dir, didRotate)
	must(err)
	// TODO: should I change filerotate so that it opens the file immedaitely?
	logf("opened http log file\n")
	return func() {
		httpLogger.Close()
	}
}

func hasSpacesCreds() bool {
	return os.Getenv("SPACES_KEY") != "" && os.Getenv("SPACES_SECRET") != ""
}

func newMinioSpacesClient() *minioutil.Client {
	config := &minioutil.Config{
		Bucket:   "kjklogs",
		Access:   os.Getenv("SPACES_KEY"),
		Secret:   os.Getenv("SPACES_SECRET"),
		Endpoint: "nyc3.digitaloceanspaces.com",
	}
	mc, err := minioutil.New(config)
	must(err)
	return mc
}
