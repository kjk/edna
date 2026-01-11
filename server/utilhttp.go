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

func tempRedirect(w http.ResponseWriter, r *http.Request, newURL string) {
	http.Redirect(w, r, newURL, http.StatusTemporaryRedirect)
}

func serveJSONData(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func serveJSON(w http.ResponseWriter, v any, code int) {
	d, err := json.Marshal(v)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		io.WriteString(w, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(d)
}

func serveJSONOk(w http.ResponseWriter, v any) {
	serveJSON(w, v, http.StatusOK)
}
