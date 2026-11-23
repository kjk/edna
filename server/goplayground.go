package server

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const userAgent = "http://edna.arslexis.io"

// maxSnippetSize value taken from
// https://github.com/golang/playground/blob/master/app/goplay/share.go
const maxSnippetSize = 64 * 1024

// FmtResponse is the response returned from
// upstream play.golang.org/fmt request
type FmtResponse struct {
	Body  string
	Error string
}

// CompileEvent represents individual
// event record in CompileResponse
type CompileEvent struct {
	Message string
	Kind    string
	Delay   time.Duration
}

// CompileResponse is the response returned from
// upstream play.golang.org/compile request
type CompileResponse struct {
	Body   *string
	Events []*CompileEvent
	Errors string
}

func doRequest(method, url, contentType string, body io.Reader) ([]byte, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Content-Type", contentType)
	_, d, err := doLimitedRequest(http.DefaultClient, req, maxSnippetSize)
	return d, err
}

func postForm(url string, data url.Values) ([]byte, error) {
	return doRequest("POST", url, "application/x-www-form-urlencoded", strings.NewReader(data.Encode()))
}

func runShare(body io.Reader) ([]byte, error) {
	return doRequest("POST", "https://play.golang.org/share", "text/plain", body)
}

func runImports(body *string) ([]byte, error) {
	form := url.Values{}
	form.Add("imports", "true")
	form.Add("body", *body)

	return postForm("https://play.golang.org/fmt", form)
}

func runCompile(body *string) ([]byte, error) {
	form := url.Values{}
	form.Add("body", *body)
	form.Add("version", "2")

	return postForm("https://play.golang.org/compile", form)
}

// readAndFormatBody reads the POSTed source code and runs it through the
// playground's goimports formatter. It returns the original source and the
// formatter's response. On failure it writes an HTTP error and returns ok == false.
func readAndFormatBody(w http.ResponseWriter, r *http.Request) (body string, formatted []byte, ok bool) {
	if !requireMethod(w, r, http.MethodPost) {
		return "", nil, false
	}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request data", http.StatusInternalServerError)
		return "", nil, false
	}
	body = string(bodyBytes)
	formatted, err = runImports(&body)
	if err != nil {
		logf("runImports() error: %v", err)
		http.Error(w, "Failed to format source code", http.StatusInternalServerError)
		return "", nil, false
	}
	return body, formatted, true
}

// format code snippet
func fmtHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	_, bodyBytes, ok := readAndFormatBody(w, r)
	if !ok {
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(bodyBytes)
}

func compileHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	body, bodyBytes, ok := readAndFormatBody(w, r)
	if !ok {
		return
	}

	fmtResponse := FmtResponse{}
	if !decodeUpstreamJSON(w, bodyBytes, &fmtResponse, "fmtResponse") {
		return
	}

	if fmtResponse.Error != "" {
		w.Write(bodyBytes)
		return
	}

	bodyUpdated := fmtResponse.Body != body

	bodyBytes, err := runCompile(&fmtResponse.Body)
	if err != nil {
		logf("runCompile() error: %v", err)
		http.Error(w, "Failed to compile source code", http.StatusInternalServerError)
		return
	}

	if !bodyUpdated {
		w.Write(bodyBytes)
		return
	}

	// return a new payload with the formatted body

	compileResponse := CompileResponse{}

	if !decodeUpstreamJSON(w, bodyBytes, &compileResponse, "compileResponse") {
		return
	}

	compileResponse.Body = &fmtResponse.Body

	bodyBytes, err = json.Marshal(compileResponse)
	if err != nil {
		logf("compileResponse marshal error: %v", err)
		http.Error(w, "Failed to encode data", http.StatusInternalServerError)
		return
	}

	w.Write(bodyBytes)
}

func shareHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if !requireMethod(w, r, http.MethodPost) {
		return
	}

	bodyBytes, err := runShare(r.Body)
	if err != nil {
		http.Error(w, "Failed to send share request", http.StatusInternalServerError)
		return
	}

	w.Write(bodyBytes)
}

// given the hash of the content get the content
func loadHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if !requireMethod(w, r, http.MethodGet) {
		return
	}

	response, bodyBytes, err := httpGetLimited("https://play.golang.org/p/"+url.PathEscape(r.URL.RawQuery)+".go", maxSnippetSize)
	if err != nil {
		http.Error(w, "Failed to load snippet", http.StatusInternalServerError)
		return
	}

	if response.StatusCode != http.StatusOK {
		http.Error(w, string(bodyBytes), response.StatusCode)
		return
	}

	w.Write(bodyBytes)
}

func handleGoPlayground(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	switch uri {
	case "/api/goplay/compile":
		compileHandler(w, r)
		return
	case "/api/goplay/share":
		shareHandler(w, r)
		return
	case "/api/goplay/load":
		loadHandler(w, r)
		return
	case "/api/goplay/fmt":
		fmtHandler(w, r)
		return
	}

	http.NotFound(w, r)
}
