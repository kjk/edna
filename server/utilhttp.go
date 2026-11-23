package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

func serveInternalError(w http.ResponseWriter, err error) {
	w.WriteHeader(http.StatusInternalServerError)
	io.WriteString(w, err.Error())
}

func serveJSONData(w http.ResponseWriter, data []byte) {
	serveJSONDataWithStatus(w, http.StatusOK, data)
}

func serveJSONDataWithStatus(w http.ResponseWriter, status int, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(data)
}

// readAllLimited reads r but fails if it has more than max bytes
func readAllLimited(r io.Reader, max int64) ([]byte, error) {
	d, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(d)) > max {
		return nil, fmt.Errorf("response is larger than %d bytes", max)
	}
	return d, nil
}

// decodeUpstreamJSON unmarshals a response from an upstream server into v.
// On failure it writes an HTTP error and returns false
func decodeUpstreamJSON(w http.ResponseWriter, d []byte, v any, what string) bool {
	if err := json.Unmarshal(d, v); err != nil {
		logf("%s unmarshal error: %v", what, err)
		http.Error(w, "Failed to decode upstream server response", http.StatusInternalServerError)
		return false
	}
	return true
}

// requireMethod writes a 405 error and returns false if r isn't a method request
func requireMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method != method {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return false
	}
	return true
}
