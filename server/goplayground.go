package server

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const userAgent = "http://tools.arslexis.io/goplayground/"

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
	req.Header.Add("User-Agent", userAgent)
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	var bodyBytes bytes.Buffer
	_, err = io.Copy(&bodyBytes, io.LimitReader(response.Body, maxSnippetSize+1))
	response.Body.Close()
	if err != nil {
		return nil, err
	}
	if bodyBytes.Len() > maxSnippetSize {
		return nil, errors.New("snippet is too large")
	}
	return bodyBytes.Bytes(), nil
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

// format code snippet
func fmtHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request data", http.StatusInternalServerError)
		return
	}

	body := string(bodyBytes)
	bodyBytes, err = runImports(&body)
	if err != nil {
		log.Printf("runImports() error: %v", err)
		http.Error(w, "Failed to format source code", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write(bodyBytes)
}

func compileHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request data", http.StatusInternalServerError)
		return
	}

	body := string(bodyBytes)

	bodyBytes, err = runImports(&body)
	if err != nil {
		log.Printf("runImports() error: %v", err)
		http.Error(w, "Failed to format source code", http.StatusInternalServerError)
		return
	}

	fmtResponse := FmtResponse{}

	err = json.Unmarshal(bodyBytes, &fmtResponse)
	if err != nil {
		log.Printf("fmtResponse unmarshal error: %v", err)
		http.Error(w, "Failed to decode upstream server response", http.StatusInternalServerError)
		return
	}

	if fmtResponse.Error != "" {
		w.Write(bodyBytes)
		return
	}

	bodyUpdated := fmtResponse.Body != body

	bodyBytes, err = runCompile(&fmtResponse.Body)
	if err != nil {
		log.Printf("runCompile() error: %v", err)
		http.Error(w, "Failed to compile source code", http.StatusInternalServerError)
		return
	}

	if !bodyUpdated {
		w.Write(bodyBytes)
		return
	}

	// return a new payload with the formatted body

	compileResponse := CompileResponse{}

	err = json.Unmarshal(bodyBytes, &compileResponse)
	if err != nil {
		log.Printf("compileResponse unmarshal error: %v", err)
		http.Error(w, "Failed to decode upstream server response", http.StatusInternalServerError)
		return
	}

	compileResponse.Body = &fmtResponse.Body

	bodyBytes, err = json.Marshal(compileResponse)
	if err != nil {
		log.Printf("compileResponse marshal error: %v", err)
		http.Error(w, "Failed to encode data", http.StatusInternalServerError)
		return
	}

	w.Write(bodyBytes)
}

func shareHandler(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response, err := http.Get("https://play.golang.org/p/" + r.URL.RawQuery + ".go")
	if err != nil {
		http.Error(w, "Failed to load snippet", http.StatusInternalServerError)
		return
	}
	defer response.Body.Close()

	bodyBytes, err := io.ReadAll(response.Body)
	if err != nil {
		http.Error(w, "Failed to read data", http.StatusInternalServerError)
	}

	if response.StatusCode != http.StatusOK {
		http.Error(w, string(bodyBytes), response.StatusCode)
		return
	}

	w.Write(bodyBytes)
}

func handleGoPlayground(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	call := strings.TrimPrefix(uri, "/api/goplay/")
	if call == "" {
		logErrorf("/api/goplay/ has no name\n")
		return
	}
	switch call {
	case "compile":
		compileHandler(w, r)
		return
	case "share":
		shareHandler(w, r)
		return
	case "load":
		loadHandler(w, r)
		return
	case "fmt":
		fmtHandler(w, r)
		return
	}

	http.NotFound(w, r)
}
