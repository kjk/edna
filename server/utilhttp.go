package server

import (
	"encoding/json"
	"io"
	"net/http"
)

func serveInternalError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	io.WriteString(w, err.Error())
}

func serveJSON(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func serveJSONOK(w http.ResponseWriter, r *http.Request, v interface{}) {
	d, err := json.Marshal(v)
	must(err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(d)
	logIfErrf(err)
}

func serveIfError(w http.ResponseWriter, err error) bool {
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
