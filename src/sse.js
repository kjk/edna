import { appState } from "./appstate.svelte";
import { sessionId } from "./httputil";

let eventSource;

export function startServerSideEvents() {
  if (!appState.user) {
    console.warn("User not logged in, cannot start SSE");
    return;
  }
  console.warn("Starting SSE connection, sessionId:" + sessionId);
  let sessionIdEnc = encodeURIComponent(sessionId);
  let uri = window.location.origin + "/api/events?sessionId=" + sessionIdEnc;
  eventSource = new EventSource(uri);

  eventSource.onmessage = function (event) {
    console.warn("Received SSE:", event.data);
    // TODO: ignore ping messages
    if (event.data === "ping") {
      return;
    }
    // TODO: reload notes and their content.
    // maybe need more granular messages other than "something changed"
    // e.g. note-content-changed or note-mete-changed or note-deleted
    // that way I'll be able to properly update the UI
    // e.g. if editing a note whose content or title changed, reload the note
    // and show latest content
    // if note in any tab has been deleted, remove the tab
  };

  // Handle custom events (if you send 'event: myEvent' from server)
  // eventSource.addEventListener('myEvent', function(event) {
  //     console.log('Custom event received:', event.data);
  // });

  eventSource.onopen = function () {
    console.log("SSE connection opened");
  };

  eventSource.onerror = function (error) {
    console.error("SSE error:", error);
    // EventSource automatically reconnects on errors, but you can handle retries here
  };

  // Optional: Close the connection when needed (e.g., on page unload)
  window.addEventListener("beforeunload", function () {
    eventSource.close();
  });
}
