import { appState, findNoteById, findNoteByName } from "./appstate.svelte";
import { closeTabWithName } from "./globals";
import { sessionId } from "./httputil";
import { storeReloadNotes } from "./store";
import {
  kStoreCreateNote,
  kStoreDeleteNote,
  kStorePut,
  kStoreWriteFile,
} from "./store-local";
import { len, splitStringN } from "./util";

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

  eventSource.onmessage = async function (event) {
    console.warn("Received SSE:", event.data);
    // TODO: ignore ping messages
    if (event.data === "ping") {
      return;
    }
    let parts = splitStringN(event.data, " ", 2);
    let kind = parts[0];
    let meta = len(parts) > 1 ? parts[1] : "";
    switch (kind) {
      case kStoreDeleteNote:
        // if a tab is open for this note, close it
        let noteId = meta;
        let note = findNoteById(noteId, true);
        if (note) {
          let name = note.name;
          await closeTabWithName(name);
        }
        break;
      case kStorePut:
        console.warn(`SSE: ${kind}`);
        // TODO: reload if current note is affected
        break;
      case kStoreWriteFile:
        // TOOD: reload metadata?
        console.warn(`SSE: ${kind}`);
        break;
      case kStoreCreateNote:
        console.warn(`SSE: ${kind}`);
        break;
    }
    await storeReloadNotes();
  };

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
