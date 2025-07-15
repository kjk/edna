package server

import (
	"bytes"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/felixge/httpsnoop"
	"github.com/gorilla/securecookie"
	hutil "github.com/kjk/common/httputil"
	"github.com/kjk/common/logtastic"
	"github.com/kjk/common/u"
	"github.com/sanity-io/litter"
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

var (
	cookieName   = "nckie" // noted cookie
	secureCookie *securecookie.SecureCookie

	cookieAuthKeyHexStr = "81615f1aed7f857b4cb9c539acb5f9b5a88c9d6c4e87a4141079490773d17f5b"
	cookieEncrKeyHexStr = "00db6337a267be94a44813335bf3bd9e35868875b896fbe3758e613fbb8ec8d4"

	// maps ouath secret to login info
	loginsInProress = map[string]string{}
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

func makeSecureCookie() {
	cookieAuthKey, err := hex.DecodeString(cookieAuthKeyHexStr)
	panicIfErr(err)
	cookieEncrKey, err := hex.DecodeString(cookieEncrKeyHexStr)
	panicIfErr(err)
	secureCookie = securecookie.New(cookieAuthKey, cookieEncrKey)
}

func getGitHubSecrets() (string, string) {
	if isDev() {
		return "Ov23liHlSBA3rZzl9wHE", secretGitHub
	}
	return "Ov23lioGhkU0mvfQBrxI", secretGitHub
}

type SecureCookieValue struct {
	User      string // "kjk"
	Email     string // "kkowalczyk@gmail.com"
	Name      string // Krzysztof Kowalczyk
	AvatarURL string
}

func setSecureCookie(w http.ResponseWriter, c *SecureCookieValue) {
	panicIf(c.User == "", "setSecureCookie: empty user")
	panicIf(c.Email == "", "setSecureCookie: empty email")

	logf("setSecureCookie: user: '%s', email: '%s'\n", c.User, c.Email)
	if encoded, err := secureCookie.Encode(cookieName, c); err == nil {
		// TODO: set expiration (Expires    time.Time) long time in the future?
		cookie := &http.Cookie{
			Name:  cookieName,
			Value: encoded,
			Path:  "/",
		}
		http.SetCookie(w, cookie)
	} else {
		panicIfErr(err)
	}
}

// TODO: make it even longer?
const MonthInSeconds = 60 * 60 * 24 * 31

// to delete the cookie value (e.g. for logging out), we need to set an
// invalid value
func deleteSecureCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{
		Name:   cookieName,
		Value:  "deleted",
		MaxAge: MonthInSeconds,
		Path:   "/",
	}
	http.SetCookie(w, cookie)
}

func getSecureCookie(r *http.Request) *SecureCookieValue {
	var ret SecureCookieValue
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	// detect a deleted cookie
	if cookie.Value == "deleted" {
		return nil
	}
	err = secureCookie.Decode(cookieName, cookie.Value, &ret)
	if err != nil {
		// most likely expired cookie, so ignore. Ideally should delete the
		// cookie, but that requires access to http.ResponseWriter, so not
		// convenient for us
		return nil
	}
	panicIf(ret.User == "", "getSecureCookie: empty user")
	panicIf(ret.Email == "", "getSecureCookie: empty email")
	return &ret
}

// /auth/ghlogout
func handleLogoutGitHub(w http.ResponseWriter, r *http.Request) {
	logf("handleLogoutGitHub()\n")
	cookie := getSecureCookie(r)
	if cookie == nil {
		logf("handleLogoutGitHub: already logged out\n")
		http.Redirect(w, r, "/", http.StatusFound) // 302
		return
	}
	email := cookie.Email
	deleteSecureCookie(w)

	removeUserFn := func(u *UserInfo, i int) error {
		if i >= 0 {
			users = append(users[:i], users[i+1:]...)
		}
		return nil
	}
	doUserOpByEmail(email, removeUserFn)
	http.Redirect(w, r, "/", http.StatusFound) // 302
}

func httpScheme(r *http.Request) string {
	isLocal := strings.HasPrefix(r.Host, "localhost") || strings.HasPrefix(r.Host, "127.0.0.1")
	if isLocal {
		return "http://"
	}
	return "https://"
}

// /auth/ghlogin
func handleLoginGitHub(w http.ResponseWriter, r *http.Request) {
	redirectURL := strings.TrimSpace(r.FormValue("redirect"))
	if redirectURL == "" {
		redirectURL = "/"
	}
	logf("handleLoginGitHub: '%s', redirect: '%s'\n", r.RequestURI, redirectURL)
	clientID, _ := getGitHubSecrets()

	// secret value passed to auth server and then back to us
	state := genRandomID(8)
	muStore.Lock()
	loginsInProress[state] = redirectURL
	muStore.Unlock()

	cb := httpScheme(r) + r.Host + "/auth/githubcb"
	logf("handleLogin: cb='%s'\n", cb)

	vals := url.Values{}
	vals.Add("client_id", clientID)
	vals.Add("scope", "read:user")
	vals.Add("state", state)
	vals.Add("redirect_uri", cb)

	authURL := "https://github.com/login/oauth/authorize?" + vals.Encode()
	logf("handleLogin: doing auth 302 redirect to '%s'\n", authURL)
	http.Redirect(w, r, authURL, http.StatusFound) // 302
}

// call fn() with UserInfo under lock
func doUserOpByEmail(email string, fn func(*UserInfo, int) error) error {
	muStore.Lock()
	defer muStore.Unlock()

	for i, u := range users {
		if u.Email == email {
			return fn(u, i)
		}
	}
	return fn(nil, -1)
}

const errorURL = "/github_login_failed"

// /auth/user
// returns JSON with user info in the body
func handleAuthUser(w http.ResponseWriter, r *http.Request) {
	logf("handleAuthUser: '%s'\n", r.URL)
	v := map[string]interface{}{}
	cookie := getSecureCookie(r)
	if cookie == nil {
		v["error"] = "not logged in"
		logf("handleAuthUser: not logged in\n")
	} else {
		v["user"] = cookie.User
		v["login"] = cookie.User
		v["email"] = cookie.Email
		v["avatar_url"] = cookie.AvatarURL
		logf("handleAuthUser: logged in as '%s', '%s'\n", cookie.User, cookie.Email)
	}
	serve200JSON(w, r, v)
}

// /auth/githubcb
// as set in:
// https://github.com/settings/applications/2175661
// https://github.com/settings/applications/2175803
func handleGithubCallback(w http.ResponseWriter, r *http.Request) {
	logf("handleGithubCallback: '%s'\n", r.URL)
	state := r.FormValue("state")
	redirectURL := loginsInProress[state]
	if redirectURL == "" {
		logErrorf("invalid oauth state, no redirect for state '%s'\n", state)
		uri := "/github_login_failed?err=" + url.QueryEscape("invalid oauth state")
		http.Redirect(w, r, uri, http.StatusTemporaryRedirect)
		return
	}

	// https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
	code := r.FormValue("code")
	vals := url.Values{}
	clientId, clientSecret := getGitHubSecrets()
	vals.Add("client_id", clientId)
	vals.Add("client_secret", clientSecret)
	vals.Add("code", code)
	// redirectURL := httpScheme(r) + r.Host + "/oauthgithubcb2"
	// vals.Add("redirect_uri", redirectURL)
	uri := "https://github.com/login/oauth/access_token?" + vals.Encode()
	hdrs := map[string]string{
		"Accept": "application/json",
	}
	resp, err := postWithHeaders(uri, hdrs)
	if err != nil {
		logf("http.Post() failed with '%s'\n", err)
		// logForm(r)
		http.Redirect(w, r, errorURL+"?error="+url.QueryEscape(err.Error()), http.StatusTemporaryRedirect)
		return
	}
	var m map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&m)
	if err != nil {
		logf("json.NewDecoder() failed with '%s'\n", err)
		// logForm(r)
		http.Redirect(w, r, errorURL+"?error="+url.QueryEscape(err.Error()), http.StatusTemporaryRedirect)
	}

	errorStr := mapStr(m, "error")
	if errorStr != "" {
		http.Redirect(w, r, errorURL+"?error="+url.QueryEscape(errorStr), http.StatusTemporaryRedirect)
		return
	}

	access_token := mapStr(m, "access_token")
	token_type := mapStr(m, "token_type")
	scope := mapStr(m, "scope")

	logf("access_token: %s, token_type: %s, scope: %s\n", access_token, token_type, scope)

	_, i, err := getGitHubUserInfo(access_token)
	if err != nil {
		logf("getGitHubUserInfo() failed with '%s'\n", err)
		http.Redirect(w, r, errorURL+"?error="+url.QueryEscape(err.Error()), http.StatusTemporaryRedirect)
		return
	}
	litter.Dump(i)
	cookie := &SecureCookieValue{}
	cookie.User = i.Login
	cookie.Email = i.Email
	cookie.Name = i.Name
	cookie.AvatarURL = i.AvatarURL
	litter.Dump(cookie)
	logf("github user: '%s', email: '%s'\n", cookie.User, cookie.Email)
	setSecureCookie(w, cookie)
	logf("handleOauthGitHubCallback: redirect: '%s'\n", redirectURL)
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)

	// can't put in the background because that cancels ctx
	// logLogin(ctx(), r, i)
}

func mapStr(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func postWithHeaders(uri string, hdrs map[string]string) (*http.Response, error) {
	req, err := http.NewRequest("POST", uri, nil)
	if err != nil {
		return nil, err
	}
	for k, v := range hdrs {
		req.Header.Add(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	return resp, err
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
			http.ServeContent(w, r, "foo.txt", time.Time{}, content)
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

		case "/math.js.map":
			http.NotFound(w, r)
			return
		case "/api/currency_rates.json":
			serverApiCurrencyRates(w, r)
			return
		case "/.well-known/appspecific/com.chrome.devtools.json":
			serveChromeDevToolsJSON(w, r)
			return
		}

		if strings.HasPrefix(uri, "/api/store/") {
			handleStore(w, r)
			return
		}

		if strings.HasPrefix(uri, "/event") {
			logtastic.HandleEvent(w, r)
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
			logHTTPReq(r, m.Code, m.Written, m.Duration)
			logtastic.LogHit(r, m.Code, m.Written, m.Duration)
			// axiomLogHTTPReq(ctx(), r, m.Code, int(m.Written), m.Duration)
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
		_ = httpSrv.Shutdown(ctx())
		select {
		case <-chServerClosed:
			// do nothing
		case <-time.After(time.Second * 5):
			// timeout
			logf("timed out trying to shut down http server")
		}
		logf("stopping logtastic\n")
		logtastic.Stop()
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

func startLogtastic() {
	if logtastic.ApiKey == "" {
		return
	}
	logtastic.BuildHash = GitCommitHash
	logtastic.LogDir = getLogsDirMust()
	if isDev() || u.IsWinOrMac() {
		err := logtastic.CheckServerAlive("127.0.0.1:9327")
		if err != nil {
			logf("startLogtastic: failed to connect to logtastic server, error: %s\n", err)
			logtastic.ApiKey = ""
			return
		}
		logtastic.Server = "127.0.0.1:9327"
	} else {
		logtastic.Server = "l.arslexis.io"
	}
	logf("logtatistic server: %s\n", logtastic.Server)
}

var (
	proxyURLStr = "http://localhost:3035"
)

func runServerDev() {
	startLogtastic()
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

	//closeHTTPLog := OpenHTTPLog("onlinetool")
	//defer closeHTTPLog()

	logf("runServerDev(): starting on '%s', dev: %v\n", httpSrv.Addr, isDev())
	waitFn := serverListen(httpSrv)
	if isWinOrMac() && !flgNoOpen {
		openBrowserForServerMust(httpSrv)
	}
	waitFn()
}

func runServerProd() {
	testingProd := isWinOrMac()

	fsys := mkFsysEmbedded()
	checkHasEmbeddedFilesMust()

	if !testingProd {
		startLogtastic()
	}

	serveOpts := mkServeFileOptions(fsys)
	httpSrv := makeHTTPServer(serveOpts, nil)
	if !isWinOrMac() {
		startLogtastic()
	}
	logf("runServerProd(): starting on 'http://%s', dev: %v, prod: %v, testingProd: %v\n", httpSrv.Addr, flgRunDev, flgRunProd, testingProd)

	waitFn := serverListen(httpSrv)
	if testingProd {
		openBrowserForServerMust(httpSrv)
	}
	waitFn()
}

func testRunServerProd() {
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
