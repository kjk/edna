package server

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/felixge/httpsnoop"
	hutil "github.com/kjk/common/httputil"
	"github.com/kjk/common/log"
	"github.com/kjk/common/u"
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
	rsp, d, err := httpGetLimited(currencyRatesURL1, maxCurrencyRatesSize)
	if err != nil {
		return nil, err
	}
	if rsp.StatusCode == 200 {
		return d, nil
	}
	return nil, e("getCurrencyRates: got status code %d", rsp.StatusCode)
}

const maxCurrencyRatesSize = 1024 * 1024

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
			serveJSONData(w, []byte(cachedCurrencyRatesJSON))
			return
		}
	}

	d, err := getCurrencyRates()
	if err != nil {
		logf("serverCurrencyRates: getCurrencyRates() failed with: '%s'\n", err)
		if cachedCurrencyRatesJSON != nil {
			serveJSONData(w, cachedCurrencyRatesJSON)
			return
		}
		serveInternalError(w, err)
		return
	}
	logf("serverCurrencyRates: got data of size %d %s\n", len(d), truncData(d, 64))
	cachedCurrencyRatesJSON = d
	currencyRatesLastUpdate = time.Now()
	serveJSONData(w, d)
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
	serveJSONData(w, []byte(s))
}

func makeHTTPServer(port int, serveOpts *hutil.ServeFileOptions, proxyHandler *httputil.ReverseProxy) *http.Server {
	panicIf(serveOpts == nil, "must provide serveOpts")

	mainHandler := func(w http.ResponseWriter, r *http.Request) {
		uri := r.URL.Path
		logf("mainHandler: '%s'\n", r.RequestURI)

		switch uri {
		case "/ping", "/ping.txt":
			content := bytes.NewReader([]byte("pong"))
			http.ServeContent(w, r, "foo.txt", time.Time{}, content)
			return
		case "/math.js.map":
			http.NotFound(w, r)
			return
		case "/api/currency_rates.json":
			serverApiCurrencyRates(w, r)
			return
		case "/api/ai/models":
			handleAIModels(w, r)
			return
		case "/api/format":
			handleFormat(w, r)
			return
		case "/.well-known/appspecific/com.chrome.devtools.json":
			serveChromeDevToolsJSON(w, r)
			return
		}

		if strings.HasPrefix(uri, "/api/goplay/") {
			handleGoPlayground(w, r)
			return
		}
		if strings.HasPrefix(uri, "/lejson") {
			log.HandleEventJSON(w, r)
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
			proxyHandler.ServeHTTP(w, r)
			return
		}

		if hutil.TryServeURLFromFS(w, r, serveOpts) {
			logf("mainHandler: served '%s' via httputil.TryServeFile\n", uri)
			return
		}

		http.NotFound(w, r)
	}

	httpSrv := &http.Server{
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
		Handler:      withRequestMetrics(http.HandlerFunc(mainHandler)),
	}
	httpAddr := fmt.Sprintf(":%d", port)
	if isWinOrMac() {
		httpAddr = "localhost" + httpAddr
	}
	httpSrv.Addr = httpAddr
	return httpSrv
}

func withRequestMetrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var m httpsnoop.Metrics
		m.CaptureMetrics(w, func(w http.ResponseWriter) {
			defer func() {
				if p := recover(); p != nil {
					// ReverseProxy uses this to abort a partially written response.
					if p == http.ErrAbortHandler {
						panic(p)
					}
					logErrorf("HTTP handler panicked: %v\n", p)
					if m.Code != 0 || m.Written != 0 {
						panic(http.ErrAbortHandler)
					}
					http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
		status := m.Code
		if status == 0 {
			status = http.StatusOK
		}
		log.HTTPRequest(r, status, m.Written, m.Duration)
	})
}

func serverListenAndWait(httpSrv *http.Server) func() {
	logf("serverListenAndWait: listening on '%s'\n", httpSrv.Addr)

	chServerClosed := make(chan struct{})
	go func() {
		err := httpSrv.ListenAndServe()
		// mute error caused by Shutdown()
		if err == nil || err == http.ErrServerClosed {
			logf("HTTP server shutdown gracefully\n")
		} else {
			logf("httpSrv.ListenAndServe error '%s'\n", err)
		}
		close(chServerClosed)
	}()

	return func() {
		sctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()

		select {
		case <-sctx.Done():
			logf("Got Ctrl+C stop signal. Shutting down http server\n")
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := httpSrv.Shutdown(shutdownCtx); err != nil {
				logf("HTTP server shutdown: %v\n", err)
				_ = httpSrv.Close()
			}
		case <-chServerClosed:
			logf("server stopped")
			return
		}
		<-chServerClosed
	}
}

func openBrowserForServerMust(httpSrv *http.Server, devURL string) {
	// wait for go server
	must(u.WaitForServerReady("http://" + httpSrv.Addr + "/ping.txt"))
	if devURL != "" {
		// wait for vite dev server
		must(u.WaitForServerReady(devURL + "/"))
	}
	u.OpenBrowser("http://" + httpSrv.Addr)
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

func runServerDev(port int) {
	const vitePort = "3035"
	proxyURL := &url.URL{Scheme: "http", Host: "localhost:" + vitePort}

	logf("runServerDev\n")
	u.RunLoggedInDir(".", "bun", "install")
	closeDev, err := startLoggedInDir(".", "bun", "run", "dev", "--port", vitePort, "--strictPort")
	must(err)
	defer closeDev()

	proxyHandler := httputil.NewSingleHostReverseProxy(proxyURL)

	fsys := os.DirFS(filepath.Join("src", "public"))
	serveOpts := mkServeFileOptions(fsys)
	serveOpts.DirPrefix = "./"
	httpSrv := makeHTTPServer(port, serveOpts, proxyHandler)
	runServerAndWait(httpSrv, proxyURL.String())
}

// runServerAndWait serves until the server stops; when running locally
// (Windows, Mac) it also opens the app in a browser
func runServerAndWait(httpSrv *http.Server, devURL string) {
	waitFn := serverListenAndWait(httpSrv)
	if isWinOrMac() {
		openBrowserForServerMust(httpSrv, devURL)
	}
	waitFn()
}

func runServerProd(port int, distFS fs.ReadDirFS) {
	panicIf(u.CountFilesInFS(distFS) < 5)

	serveOpts := mkServeFileOptions(distFS)
	httpSrv := makeHTTPServer(port, serveOpts, nil)
	runServerAndWait(httpSrv, "")
}
