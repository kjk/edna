package server

import (
	"fmt"
	"math/rand"
	"net/http"
	"path/filepath"
	"sync"
	"time"

	"github.com/kjk/common/appendstore"
)

type UserInfo struct {
	User  string
	Email string
	Store *appendstore.Store
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
		if u == nil {
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
			return nil
		}

		userInfo = u
		return nil
	}
	findUserByEmailLocked(email, getOrCreateUser)
	return userInfo, nil
}

func handleStore(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	userInfo, err := getLoggedUser(r, w)
	if serveIfError(w, err) {
		logf("handleStore: %s, err: %s\n", uri, err)
		return
	}
	userEmail := userInfo.Email
	logf("handleStore: %s, userEmail: %s\n", uri, userEmail)
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
