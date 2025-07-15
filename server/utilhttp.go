package server

import (
	"encoding/json"
	"io"
	"net/http"
)

func serve500Error(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	io.WriteString(w, err.Error())
}

func serve200JSONData(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func serve200JSON(w http.ResponseWriter, r *http.Request, v interface{}) {
	d, err := json.Marshal(v)
	must(err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(d)
	logIfErrf(err)
}

func serve500IfError(w http.ResponseWriter, err error) bool {
	if err != nil {
		logErrorf("serveIfError(): %s\n", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return true
	}
	return false
}

func verifyPOSTRequest(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodPost {
		http.Error(w, "must be POST request", http.StatusBadRequest)
		return false
	}
	return true
}

// 304: not modified
func serve304(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusNotModified)
}
