package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/kjk/common/u"
)

const (
	githubServer = "https://api.github.com"
)

// https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28
type GitHubUser struct {
	Login                   string    `json:"login"`
	ID                      int       `json:"id"`
	NodeID                  string    `json:"node_id"`
	AvatarURL               string    `json:"avatar_url"`
	GravatarID              string    `json:"gravatar_id"`
	URL                     string    `json:"url"`
	HTMLURL                 string    `json:"html_url"`
	FollowersURL            string    `json:"followers_url"`
	FollowingURL            string    `json:"following_url"`
	GistsURL                string    `json:"gists_url"`
	StarredURL              string    `json:"starred_url"`
	SubscriptionsURL        string    `json:"subscriptions_url"`
	OrganizationsURL        string    `json:"organizations_url"`
	ReposURL                string    `json:"repos_url"`
	EventsURL               string    `json:"events_url"`
	ReceivedEventsURL       string    `json:"received_events_url"`
	Type                    string    `json:"type"`
	SiteAdmin               bool      `json:"site_admin"`
	Name                    string    `json:"name"`
	Company                 string    `json:"company"`
	Blog                    string    `json:"blog"`
	Location                string    `json:"location"`
	Email                   string    `json:"email"`
	Hireable                bool      `json:"hireable"`
	Bio                     string    `json:"bio"`
	TwitterUsername         string    `json:"twitter_username"`
	PublicRepos             int       `json:"public_repos"`
	PublicGists             int       `json:"public_gists"`
	Followers               int       `json:"followers"`
	Following               int       `json:"following"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`
	PrivateGists            int       `json:"private_gists"`
	TotalPrivateRepos       int       `json:"total_private_repos"`
	OwnedPrivateRepos       int       `json:"owned_private_repos"`
	DiskUsage               int       `json:"disk_usage"`
	Collaborators           int       `json:"collaborators"`
	TwoFactorAuthentication bool      `json:"two_factor_authentication"`
	Plan                    struct {
		Name          string `json:"name"`
		Space         int    `json:"space"`
		PrivateRepos  int    `json:"private_repos"`
		Collaborators int    `json:"collaborators"`
	} `json:"plan"`
}

func getGitHubTokenFromRequest(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	token := strings.TrimPrefix(auth, "token ")
	return token
}

// JSONRequest represents a JSON request
type JSONRequest struct {
	Server    string
	URIPath   string
	Etag      string // used for header If-None-Match: ${etag}
	AuthToken string // used for header Authorization: token ${token}

	Request    *http.Request
	Response   *http.Response
	Body       []byte
	Value      interface{}
	Err        error
	StatusCode int
	NoChange   bool // if Etag was given and StatusCode is 304 (NotModified)
}

// NewGitHubRequest creates new GitHub request
func NewGitHubRequest(uri string, ghToken string, value interface{}) *JSONRequest {
	return &JSONRequest{
		URIPath:   uri,
		Server:    githubServer,
		AuthToken: ghToken,
		Value:     value,
	}
}

// Get runs GET request
func (r *JSONRequest) Get() error {
	uri := r.Server + r.URIPath
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return err
	}
	if r.AuthToken != "" {
		req.Header.Set("Authorization", "token "+r.AuthToken)
	}
	if r.Etag != "" {
		req.Header.Set("If-None-Match", r.Etag)
	}
	r.Request = req
	r.Response, r.Err = http.DefaultClient.Do(req)
	if r.Err != nil {
		return r.Err
	}
	resp := r.Response
	if resp.StatusCode >= 400 {
		r.Err = fmt.Errorf("http.Do('%s') failed with '%s'", uri, resp.Status)
		return r.Err
	}
	if resp.StatusCode == http.StatusNotModified {
		r.NoChange = true
		return nil
	}
	defer u.CloseNoError(resp.Body)
	r.Body, r.Err = io.ReadAll(resp.Body)
	if r.Err != nil {
		return r.Err
	}

	if r.Value != nil {
		r.Err = json.Unmarshal(r.Body, r.Value)
	}
	return r.Err
}

func getGitHubUserInfo(ghToken string) (*JSONRequest, *GitHubUser, error) {
	endpoint := "/user"
	result := &GitHubUser{}
	req := NewGitHubRequest(endpoint, ghToken, result)
	err := req.Get()
	return req, result, err
}
