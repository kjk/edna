import { appState, findNoteById, findNoteByName } from "./appstate.svelte";
import { closeTabWithName, reloadIfCurrent } from "./globals";
import { sessionId } from "./httputil";
import { kMetadataName, loadAppMetadata } from "./metadata";
import { Note, parseNoteIdFromVerId } from "./note";
import { storeInvalidateFile, storeReloadNotes } from "./store";
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
  let uri =
    window.location.origin + "/api/sse_events?sessionId=" + sessionIdEnc;
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
    let noteId = "";
    /** @type {Note} */
    let note;
    switch (kind) {
      case kStoreDeleteNote:
        // if a tab is open for this note, close it
        noteId = meta;
        note = findNoteById(noteId, true);
        if (note) {
          let name = note.name;
          await closeTabWithName(name);
        }
        break;
      case kStorePut:
        console.warn(`SSE: ${kind}`);
        noteId = parseNoteIdFromVerId(meta);
        if (noteId) {
          note = findNoteById(noteId, true);
          if (note) {
            // must update versions so that the reload get the latest
            // alternatively, after storeReloadNotes() we could
            // remove tabs for non-existing notes and reload current note
            // if changed
            await storeReloadNotes();
            let name = note.name;
            await reloadIfCurrent(name);
          }
        }
        break;
      case kStoreWriteFile:
        // TODO: alternatively could call storeReadFile(force)
        // to force caching latest version
        await storeInvalidateFile(meta);
        if (meta.includes(kMetadataName)) {
          await loadAppMetadata();
        }
        console.warn(`SSE: ${kind} ${meta}`);
        break;
      case kStoreCreateNote:
      case "upload-encrypted":
      case "upload-decrypted":
      case "bulk-upload":
      case "upload-offline-changes":
        // will reload notes below
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
