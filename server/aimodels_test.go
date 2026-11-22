package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAIModelsRejectsBadRequests(t *testing.T) {
	cases := []struct {
		url    string
		key    string
		method string
		want   int
	}{
		{"/api/ai/models?provider=nope", "k", "GET", http.StatusBadRequest},
		{"/api/ai/models?provider=openai", "", "GET", http.StatusBadRequest},
		{"/api/ai/models?provider=openai", "k", "POST", http.StatusMethodNotAllowed},
	}
	for _, c := range cases {
		r := httptest.NewRequest(c.method, c.url, nil)
		if c.key != "" {
			r.Header.Set("X-Api-Key", c.key)
		}
		w := httptest.NewRecorder()
		handleAIModels(w, r)
		if w.Code != c.want {
			t.Errorf("%s %s: got %d, want %d", c.method, c.url, w.Code, c.want)
		}
	}
}

func TestAIModelsProvidersSetAuth(t *testing.T) {
	for name, p := range aiModelsProviders {
		r, _ := http.NewRequest("GET", p.url, nil)
		p.setHeaders(r, "secret")
		if r.Header.Get("Authorization") != "Bearer secret" && r.Header.Get("x-api-key") != "secret" {
			t.Errorf("%s: API key not set", name)
		}
	}
}
