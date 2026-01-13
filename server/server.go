package server

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/felixge/httpsnoop"
	hutil "github.com/kjk/common/httputil"
	"github.com/kjk/common/u"
)

var (
	DistFS embed.FS
	//go:embed secrets.env
	secretsEnv []byte
)

var (
	cachedCurrencyRatesJSON []byte
	currencyRatesLastUpdate time.Time
	muCurrency              sync.Mutex
	currencyUpdateFreq      = time.Hour * 24
	// https://www.exchangerate-api.com/docs/free, rate limited, updates rates once a day
	currencyRatesURL1 = "https://open.er-api.com/v6/latest/EUR"
	// I also have https://apilayer.com/marketplace/fixer-api account
	// on https://apilayer.com/account
	// which is free for 100 reqs per month
)

func getCurrencyRates() ([]byte, error) {
	rsp, err := http.Get(currencyRatesURL1)
	if err != nil {
		return nil, err
	}
	defer rsp.Body.Close()
	if rsp.StatusCode == 200 {
		return io.ReadAll(rsp.Body)
	}
	return nil, e("getCurrencyRates: got status code %d", rsp.StatusCode)
}

// TODO: implement without using https://currencies.heynote.com/rates.json
func serverApiCurrencyRates(w http.ResponseWriter, r *http.Request) {
	logf("serverCurrencyRates\n")
	muCurrency.Lock()
	defer muCurrency.Unlock()

	if cachedCurrencyRatesJSON != nil {
		sinceUpdate := time.Since(currencyRatesLastUpdate)
		logf("serverCurrencyRates: have cached data, since update: %s\n", sinceUpdate)
		if sinceUpdate < currencyUpdateFreq {
			logf("serverCurrencyRates: using cached data\n")
			serve200JSONData(w, []byte(cachedCurrencyRatesJSON))
			return
		}
	}

	d, err := getCurrencyRates()
	if err != nil {
		logf("serverCurrencyRates: getCurrencyRates() failed with: '%s'\n", err)
		if cachedCurrencyRatesJSON != nil {
			serve200JSONData(w, cachedCurrencyRatesJSON)
			return
		}
		serve500Error(w, err)
		return
	}
	logf("serverCurrencyRates: got data of size %d %s\n", len(d), truncData(d, 64))
	cachedCurrencyRatesJSON = d
	currencyRatesLastUpdate = time.Now()
	serve200JSONData(w, d)
}

func truncData(data []byte, maxLen int) string {
	if len(data) > maxLen {
		return string(data[:maxLen]) + "..."
	}
	return string(data)
}

func isMacBasedOnUserAgent(r *http.Request) bool {
	ua := strings.ToLower(r.UserAgent())
	// TODO: verify this
	return strings.Contains(ua, "mac")
}

func serveChromeDevToolsJSON(w http.ResponseWriter, r *http.Request) {
	srcDir, err := filepath.Abs("src")
	must(err)
	// stupid Chrome doesn't accept windows-style paths
	srcDir = filepath.ToSlash(srcDir)
	// uuid should be unique for each workspace
	uuid := "8f6e3d9a-4b7c-4c1e-a2d5-7f9b0e3c1284"
	s := `{
  "workspace": {
    "root": "{{root}}",
    "uuid": "{{uuid}}"
  }
}`

	s = strings.ReplaceAll(s, "{{root}}", srcDir)
	s = strings.ReplaceAll(s, "{{uuid}}", uuid)
	// logf("serveChromeDevToolsJSON:\n\n%s\n\n", s)
	serve200JSONData(w, []byte(s))
}

func makeHTTPServer(serveOpts *hutil.ServeFileOptions, proxyHandler *httputil.ReverseProxy) *http.Server {
	panicIf(serveOpts == nil, "must provide serveOpts")

	makeSecureCookie()

	mainHandler := func(w http.ResponseWriter, r *http.Request) {
		uri := r.URL.Path
		logf("mainHandler: '%s'\n", r.RequestURI)

		switch uri {
		case "/ping", "/ping.txt":
			content := bytes.NewReader([]byte("pong"))
			// foo.txt is so that they set the right mime type
			http.ServeContent(w, r, ".txt", time.Time{}, content)
			return
		case "/auth/ghlogin":
			handleLoginGitHub(w, r)
			return
		case "/auth/ghlogout":
			handleLogoutGitHub(w, r)
			return
		case "/auth/githubcb":
			handleGithubCallback(w, r)
			return
		case "/auth/user":
			handleAuthUser(w, r)
			return
		case "/api/send_login_in_email":
			handleAPISendLogInEmail(w, r)
			return
		case "/api/verify_login_code":
			handleAPIVerifyLoginCode(w, r)
			return
		case "/api/sse_events":
			handleEvents(w, r)
			return

		case "/api/currency_rates.json":
			serverApiCurrencyRates(w, r)
			return
		case "/.well-known/appspecific/com.chrome.devtools.json":
			serveChromeDevToolsJSON(w, r)
			return
		}

		if strings.HasPrefix(uri, "/login/") {
			handleLogInLink(w, r)
			return
		}

		if strings.HasPrefix(uri, "/api/store/") {
			handleStore(w, r)
			return
		}

		if strings.HasPrefix(uri, "/event") {
			handleEvent(w, r)
			return
		}
		if uri == "/help" {
			file := "help-win.html"
			if isMacBasedOnUserAgent(r) {
				file = "help-mac.html"
			}
			filePath := path.Join(serveOpts.DirPrefix, file)
			ok := hutil.TryServeFileFromFS(w, r, serveOpts, filePath)
			panicIf(!ok)
			return
		}

		tryServeRedirect := func(uri string) bool {
			if uri == "/home" {
				http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
				return true
			}
			return false
		}
		if tryServeRedirect(uri) {
			return
		}

		if proxyHandler != nil {
			transformRequestForProxy := func() {
				uris := []string{}
				shouldProxyURI := slices.Contains(uris, uri)
				if !shouldProxyURI {
					return
				}
				newPath := uri + ".html"
				newURI := strings.Replace(r.URL.String(), uri, newPath, 1)
				var err error
				r.URL, err = url.Parse(newURI)
				must(err)
			}

			transformRequestForProxy()
			proxyHandler.ServeHTTP(w, r)
			return
		}

		if hutil.TryServeURLFromFS(w, r, serveOpts) {
			logf("mainHandler: served '%s' via httputil.TryServeFile\n", uri)
			return
		}

		http.NotFound(w, r)
	}

	handlerWithMetrics := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m := httpsnoop.CaptureMetrics(http.HandlerFunc(mainHandler), w, r)
		defer func() {
			if p := recover(); p != nil {
				logErrorf("handlerWithMetrics: panicked with with %v\n", p)
				errStr := fmt.Sprintf("Error: %v", p)
				http.Error(w, errStr, http.StatusInternalServerError)
				return
			}
			logHTTPRequest(r, m.Code, m.Written, m.Duration)
		}()
	})

	httpSrv := &http.Server{
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
		Handler:      http.HandlerFunc(handlerWithMetrics),
	}
	httpAddr := fmt.Sprintf(":%d", httpPort)
	if isWinOrMac() {
		httpAddr = "localhost" + httpAddr
	}
	httpSrv.Addr = httpAddr
	return httpSrv
}

// returns a function that listens for SIGINT or SIGKILL and shuts down the server gracefully
func serverListen(httpSrv *http.Server) func() {
	chServerClosed := make(chan bool, 1)
	go func() {
		err := httpSrv.ListenAndServe()
		// mute error caused by Shutdown()
		if err == http.ErrServerClosed {
			err = nil
		}
		if err == nil {
			logf("HTTP server shutdown gracefully\n")
		} else {
			logf("httpSrv.ListenAndServe error '%s'\n", err)
		}
		chServerClosed <- true
	}()

	return func() {
		waitForSigIntOrKill()

		logf("Got one of the signals. Shutting down http server\n")
		sseNotifyExit()

		ctx, cancel := context.WithTimeout(ctx(), 5*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(ctx)
		<-chServerClosed
	}
}

func waitForServerReadyMust(uri string) {
	logf("waitForServerReady: waiting for '%s' to be ready\n", uri)
	for range 10 {
		resp, err := http.Get(uri)
		if err == nil && resp.StatusCode == http.StatusOK {
			logf("waitForServerReady: got response from '%s'\n", uri)
			resp.Body.Close()
			return
		}
		logf("waitForServerReady: failed to get response from '%s', error: %v\n", uri, err)
		time.Sleep(time.Second * 1)
	}
	panicIf(true, "failed to get response from '%s'", uri)
}

func openBrowserForServerMust(httpSrv *http.Server) {
	// wait for go server
	waitForServerReadyMust("http://" + httpSrv.Addr + "/ping.txt")
	if flgRunDev {
		// wait for vite dev server
		waitForServerReadyMust(proxyURLStr + "/")
	}
	u.OpenBrowser("http://" + httpSrv.Addr)
}

func mkFsysEmbedded() fs.FS {
	printFS(DistFS)
	logf("mkFsysEmbedded: serving from embedded FS\n")
	return DistFS
}

func mkFsysDirPublic() fs.FS {
	dir := filepath.Join("src", "public")
	fsys := os.DirFS(dir)
	printFS(fsys)
	logf("mkFsysDirPublic: serving from dir '%s'\n", dir)
	return fsys
}

func mkServeFileOptions(fsys fs.FS) *hutil.ServeFileOptions {
	return &hutil.ServeFileOptions{
		SupportCleanURLS:     true,
		ForceCleanURLS:       true,
		FS:                   fsys,
		DirPrefix:            "dist/",
		LongLivedURLPrefixes: []string{"/assets/"},
		ServeCompressed:      false, // when served via Cloudflare, no need to compress
	}
}

var (
	proxyURLStr = "http://localhost:3035"
)

func runServerDev() {
	// must be same as vite.config.js

	logf("runServerDev\n")
	if hasBun() {
		runLoggedInDir(".", "bun", "install")
		closeDev, err := startLoggedInDir(".", "bun", "run", "dev")
		must(err)
		defer closeDev()
	} else {
		runLoggedInDir(".", "npm")
		closeDev, err := startLoggedInDir(".", "npm", "dev")
		must(err)
		defer closeDev()
	}

	proxyURL, err := url.Parse(proxyURLStr)
	must(err)
	proxyHandler := httputil.NewSingleHostReverseProxy(proxyURL)

	fsys := mkFsysDirPublic()
	serveOpts := mkServeFileOptions(fsys)
	serveOpts.DirPrefix = "./"
	httpSrv := makeHTTPServer(serveOpts, proxyHandler)

	logf("runServerDev(): starting on '%s', dev: %v\n", httpSrv.Addr, isDevOrLocal())
	waitFn := serverListen(httpSrv)
	if isWinOrMac() {
		openBrowserForServerMust(httpSrv)
	}
	waitFn()
}

func runServerProd() {
	testingProd := isWinOrMac()

	fsys := mkFsysEmbedded()
	checkHasEmbeddedFilesMust()

	serveOpts := mkServeFileOptions(fsys)
	httpSrv := makeHTTPServer(serveOpts, nil)
	logf("runServerProd(): starting on 'http://%s', dev: %v, prod: %v, testingProd: %v\n", httpSrv.Addr, flgRunDev, flgRunProd, testingProd)

	waitFn := serverListen(httpSrv)
	if testingProd {
		openBrowserForServerMust(httpSrv)
	}
	waitFn()
}
