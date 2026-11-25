package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFormatRejectsBadRequests(t *testing.T) {
	cases := []struct {
		name   string
		method string
		query  string
		origin string
		status int
	}{
		{"get", http.MethodGet, "type=js", "", http.StatusMethodNotAllowed},
		{"cross origin", http.MethodPost, "type=js", "https://other.example", http.StatusForbidden},
		{"unsupported type", http.MethodPost, "type=txt", "", http.StatusBadRequest},
		{"invalid width", http.MethodPost, "type=js&tabWidth=9", "", http.StatusBadRequest},
		{"invalid tab setting", http.MethodPost, "type=js&useTabs=1", "", http.StatusBadRequest},
		{"unavailable", http.MethodPost, "type=js", "", http.StatusServiceUnavailable},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest(c.method, "http://edna.example/api/format?"+c.query, strings.NewReader("let x=1"))
			if c.origin != "" {
				r.Header.Set("Origin", c.origin)
			}
			w := httptest.NewRecorder()
			handleFormat(w, r)
			if w.Code != c.status {
				t.Errorf("got status %d, want %d", w.Code, c.status)
			}
		})
	}
}

func TestFormatRejectsOversizeBody(t *testing.T) {
	wasReady := oxfmtReady.Swap(true)
	t.Cleanup(func() { oxfmtReady.Store(wasReady) })
	r := httptest.NewRequest(http.MethodPost, "/api/format?type=js", strings.NewReader(strings.Repeat(" ", maxFormatSize+1)))
	w := httptest.NewRecorder()
	handleFormat(w, r)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("got status %d, want %d", w.Code, http.StatusRequestEntityTooLarge)
	}
}
