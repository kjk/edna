package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestMetricsRecoversHandlerPanic(t *testing.T) {
	handler := withRequestMetrics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("handler failure")
	}))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("got status %d, want %d", recorder.Code, http.StatusInternalServerError)
	}
}

func TestRequestMetricsAbortsPartialResponseAfterPanic(t *testing.T) {
	handler := withRequestMetrics(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		panic("handler failure")
	}))
	recorder := httptest.NewRecorder()
	defer func() {
		if p := recover(); p != http.ErrAbortHandler {
			t.Errorf("got panic %v, want http.ErrAbortHandler", p)
		}
		if recorder.Body.Len() != 0 {
			t.Errorf("got unexpected response body %q", recorder.Body.String())
		}
	}()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
}
