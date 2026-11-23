package server

import (
	"io"
	"net/http"
	"time"
)

// AI providers whose list of models we proxy. Fetching through the server (and
// not directly from the browser) doesn't depend on providers allowing CORS.
type aiModelsProvider struct {
	url string
	// sets authentication (and other required) headers
	setHeaders func(r *http.Request, apiKey string)
}

func setBearerAuth(r *http.Request, apiKey string) {
	r.Header.Set("Authorization", "Bearer "+apiKey)
}

var aiModelsProviders = map[string]aiModelsProvider{
	"openai": {
		url:        "https://api.openai.com/v1/models",
		setHeaders: setBearerAuth,
	},
	"xai": {
		url:        "https://api.x.ai/v1/models",
		setHeaders: setBearerAuth,
	},
	"openrouter": {
		url:        "https://openrouter.ai/api/v1/models",
		setHeaders: setBearerAuth,
	},
	"anthropic": {
		url: "https://api.anthropic.com/v1/models?limit=1000",
		setHeaders: func(r *http.Request, apiKey string) {
			r.Header.Set("x-api-key", apiKey)
			r.Header.Set("anthropic-version", "2023-06-01")
		},
	},
}

const maxAIModelsResponseSize = 16 * 1024 * 1024

var aiModelsClient = &http.Client{Timeout: 30 * time.Second}

// GET /api/ai/models?provider=openai with the provider's API key in X-Api-Key
// header. Returns the provider's response (body and status code) as is: the
// client parses it and a 401 tells it the key is not valid.
// Note: never log the API key.
func handleAIModels(w http.ResponseWriter, r *http.Request) {
	if !requireMethod(w, r, http.MethodGet) {
		return
	}
	providerName := r.URL.Query().Get("provider")
	provider, ok := aiModelsProviders[providerName]
	if !ok {
		http.Error(w, "unknown provider", http.StatusBadRequest)
		return
	}
	apiKey := r.Header.Get("X-Api-Key")
	if apiKey == "" {
		http.Error(w, "missing X-Api-Key header", http.StatusBadRequest)
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, provider.url, nil)
	if err != nil {
		serveInternalError(w, err)
		return
	}
	provider.setHeaders(req, apiKey)
	req.Header.Set("User-Agent", userAgent)
	rsp, err := aiModelsClient.Do(req)
	if err != nil {
		logf("handleAIModels: provider '%s' failed with '%s'\n", providerName, err)
		http.Error(w, "request to provider failed", http.StatusBadGateway)
		return
	}
	defer rsp.Body.Close()
	d, err := io.ReadAll(io.LimitReader(rsp.Body, maxAIModelsResponseSize))
	if err != nil {
		http.Error(w, "reading provider response failed", http.StatusBadGateway)
		return
	}
	logf("handleAIModels: provider '%s' status %d, %d bytes\n", providerName, rsp.StatusCode, len(d))
	w.Header().Set("Cache-Control", "no-store")
	serveJSONDataWithStatus(w, rsp.StatusCode, d)
}
