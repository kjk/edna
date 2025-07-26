package server

import (
	"fmt"
	"net/http"
	"time"
)

type sseUpdate struct {
	message string
}

type sseLogin struct {
	u         *UserInfo
	ch        chan *sseUpdate
	sessionID string
}

var (
	sseLogins []*sseLogin
)

func sseNotifyExit() {
	logf("sseNotifyExit: notifying all SSE logins to exit\n")

	muStore.Lock()
	defer muStore.Unlock()

	for _, login := range sseLogins {
		update := &sseUpdate{
			message: "exit",
		}
		select {
		case login.ch <- update:
		default:
			// channel is full, skip sending
		}
	}
}

func sseNotify(r *http.Request, u *UserInfo, message string) {
	sessionID := r.Header.Get("X-Elaris-Session-Id")
	if sessionID == "" {
		logf("sseNotify: sessionId is empty for user %s, message: %s", u.Email, message)
		return
	}
	muStore.Lock()
	defer muStore.Unlock()

	for _, login := range sseLogins {
		if login.u.Email != u.Email {
			continue // only notify the user who made the change
		}
		if login.sessionID == sessionID {
			continue // don't notify ourselves
		}
		update := &sseUpdate{
			message: message,
		}
		select {
		case login.ch <- update:
		default:
			// channel is full, skip sending
		}
	}
}

// SSE /api/events?sessionId=<sessionId>
func handleEvents(w http.ResponseWriter, r *http.Request) {
	uri := r.URL.Path
	userInfo, err := getLoggedUser(r, w)
	if serve500TextIfError(w, err, "handleStore: %s, err: %v", uri, err) {
		return
	}
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		http.Error(w, "sessionId is required", http.StatusBadRequest)
		return
	}
	logf("handleEvents: userEmail: %s, sessionId: %s\n", userInfo.Email, sessionID)
	login := &sseLogin{
		u:         userInfo,
		ch:        make(chan *sseUpdate),
		sessionID: sessionID,
	}
	muStore.Lock()
	sseLogins = append(sseLogins, login)
	muStore.Unlock()

	// Set required headers for SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*") // Optional: Allow cross-origin if needed

	// Get the flusher to send data immediately
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}
	for {
		select {
		case update := <-login.ch:
			logf("handleEvents: userEmail: %s, sessionId: %s, update: %s\n", userInfo.Email, sessionID, update.message)
			if update.message == "exit" {
				goto exit
			}
			_, err = fmt.Fprintf(w, "data: %s\n\n", update.message)
		case <-time.After(5 * time.Second):
			// wake up every 5 seconds, write a ping to keep alive
			// and detect broken connection
			logf("handleEvents: userEmail: %s, sessionId: %s, sending ping\n", userInfo.Email, sessionID)
			_, err = fmt.Fprint(w, "data: ping\n\n")
		}
		if err != nil {
			goto exit
		}
		flusher.Flush()
	}
exit:

	muStore.Lock()
	for i, l := range sseLogins {
		if l == login {
			sliceRemoveAt(&sseLogins, i)
			break
		}
	}
	muStore.Unlock()

	logf("handleEvents: userEmail: %s, sessionId: %s, closed connection\n", userInfo.Email, sessionID)
}
