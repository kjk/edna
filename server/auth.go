package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kjk/common/appendstore"
	"github.com/sanity-io/litter"
)

const errorURL = "/github_login_failed"

type logInData struct {
	Code     string
	Email    string
	ExpireAt time.Time
}

func createLogInCode(email string) string {
	code := genRandomLoginCode(6)
	logf("createLogInCode: email=%s, code=%s\n")
	v := &logInData{
		Code:     code,
		Email:    email,
		ExpireAt: time.Now().Add(time.Minute * 60),
	}

	muStore.Lock()
	defer muStore.Unlock()
	push(&emailLoginsInProgress, v)
	return code
}

func getLogInInfo(code string) *logInData {
	muStore.Lock()
	defer muStore.Unlock()
	var expiredIdx []int
	now := time.Now()
	var found *logInData
	for i, v := range emailLoginsInProgress {
		if now.After(v.ExpireAt) {
			push(&expiredIdx, i)
		}
		found = v
	}
	for _, i := range expiredIdx {
		sliceRemoveAt(&emailLoginsInProgress, i)
	}
	return found
}

// /auth/user
// returns JSON with user info in the body
func handleAuthUser(w http.ResponseWriter, r *http.Request) {
	logf("handleAuthUser: '%s'\n", r.URL)
	v := map[string]any{}
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
	serve200JSON(w, v)
}

// /auth/githubcb
// as set in:
// https://github.com/settings/applications/2175661
// https://github.com/settings/applications/2175803
func handleGithubCallback(w http.ResponseWriter, r *http.Request) {
	logf("handleGithubCallback: '%s'\n", r.URL)
	state := r.FormValue("state")
	redirectURL := oauthLoginsInProgress[state]
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
	var m map[string]any
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
	oauthLoginsInProgress[state] = redirectURL
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

func getLoggedUser(r *http.Request, _ http.ResponseWriter) (*UserInfo, error) {
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

		dataDir := getDataDirMust()
		dirName := ToValidFileName(email)
		dataDir = filepath.Join(dataDir, dirName)
		err := os.MkdirAll(dataDir, 0755)
		if err != nil {
			logErrorf("getLoggedUser(): failed to create data dir for user %s, err: %s\n", email, err)
			return err
		}
		userInfo = &UserInfo{
			Email:   cookie.Email,
			User:    cookie.User,
			DataDir: dataDir,
		}

		userInfo.Store = &appendstore.Store{
			DataDir:       dataDir,
			IndexFileName: "index.txt",
			DataFileName:  "data.bin",
		}
		err = appendstore.OpenStore(userInfo.Store)
		if err != nil {
			logErrorf("getLoggedUser(): failed to open store for user %s, err: %s\n", email, err)
			return err
		}
		users = append(users, userInfo)
		return nil
	}
	doUserOpByEmail(email, getOrCreateUser)
	return userInfo, nil
}

// /api/verify-login-code?code=<code>
func handleAPIVerifyLoginCode(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	v := getLogInInfo(code)
	if v == nil {
		serve404JSON(w, map[string]any{
			"status": "error",
			"error":  "login code not found",
		})
		return
	}
	serve200JSON(w, map[string]any{
		"status":  "ok",
		"message": "login code verified",
	})
}

func serve404JSON(w http.ResponseWriter, v map[string]any) {
	d, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusNotFound)
	w.Write(d)
}

// GET /login/{code}
func handleLogInLink(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	code := strings.TrimPrefix(uri, "/login/")
	logf("handleLogInLink: code='%s'\n", code)
	v := getLogInInfo(code)
	if v == nil {
		serve404(w, "invalid login code")
		return
	}

	email := v.Email
	var userInfo *UserInfo
	getOrCreateUser := func(u *UserInfo, i int) error {
		if u != nil {
			userInfo = u
			return nil
		}

		dataDir := getDataDirMust()
		dirName := ToValidFileName(email)
		dataDir = filepath.Join(dataDir, dirName)
		err := os.MkdirAll(dataDir, 0755)
		if err != nil {
			logErrorf("getLoggedUser(): failed to create data dir for user %s, err: %s\n", email, err)
			return err
		}
		user := strings.Split(email, "@")[0]
		userInfo = &UserInfo{
			Email:   email,
			User:    user,
			DataDir: dataDir,
		}

		userInfo.Store = &appendstore.Store{
			DataDir:       dataDir,
			IndexFileName: "index.txt",
			DataFileName:  "data.bin",
		}
		err = appendstore.OpenStore(userInfo.Store)
		if err != nil {
			logErrorf("getLoggedUser(): failed to open store for user %s, err: %s\n", email, err)
			return err
		}
		users = append(users, userInfo)
		return nil
	}
	err := doUserOpByEmail(email, getOrCreateUser)
	if serve400JSONIfErr(w, err) {
		return
	}

	c := &SecureCookieValue{
		User:  userInfo.User,
		Email: userInfo.Email,
		Name:  userInfo.User,
	}
	setSecureCookie(w, c)
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)

	// go func() {
	// 	body := fmt.Sprintf("user %s (%d) signed in via e-mail code\n", email, userID)
	// 	notifyMeViaEmail("log in via email code", body, email)
	// }()
}
