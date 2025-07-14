import { AppendStore } from "./appendstore";
import { Note } from "./note";

export class ContentCache {
  /** @type {AppendStore} */
  store;

  constructor(store) {
    this.store = store;
  }
}

export class BackendStore {
  /** @type {ContentCache} */
  contentCache;

  constructor(contentCache) {
    this.contentCache = contentCache;
  }

  async writeNoteMeta(m) {
    throw new Error("NYI");
  }
  async writeStringToFile(fileName, s) {
    throw new Error("NYI");
  }
  async readFileAsString(fileName) {
    throw new Error("NYI");
    return "";
  }
  async deleteNote(noteId) {
    throw new Error("NYI");
  }
  async createNote(noteId, name) {
    throw new Error("NYI");
  }
  async writeNoteContent(verId, content) {
    throw new Error("NYI");
  }
  async loadLatestNoteContent(noteId) {
    throw new Error("NYI");
    return "";
  }
}

/**
 * @param {string} s
 * @returns {any}
 */
function parseLatestNotes(s) {
  let init = {
    Ver: 1,
    LastChangeID: 0,
    Notes: [],
  };
  if (!s) {
    return init;
  }
  try {
    return JSON.parse(s);
  } catch (e) {
    console.warn("Failed to parse latest notes:", e);
  }
  return init;
}

const kNoteFlagIsStarred = 0x01;
const kNoteFlagIsArchived = 0x02;

function notesFromCompact(compactNotes) {
  let res = [];
  for (let n of compactNotes) {
    let note = new Note();
    note.id = n[0];
    note.name = n[1];
    let flags = n[2];
    note.isStarred = (flags & kNoteFlagIsStarred) !== 0;
    note.isArchived = (flags & kNoteFlagIsArchived) !== 0;
    note.altShortcut = n[3] || "";
    // 4 is createdAt
    // 5 is updatedAt
    note.versionIds = n.slice(6);
    res.push(note);
  }
  return res;
}

// cached result of /api/store/getNotes in localStorage
const kKeyLatestNotes = "elaris:latestNotes";
async function backendGetLatestNotes() {
  console.log("backendGetLatestNotes");
  let s = localStorage.getItem(kKeyLatestNotes);
  let curr = parseLatestNotes(s);
  let rsp = await fetch(
    "/api/store/getNotes?lastChangeID=" + curr.LastChangeID,
  );
  if (!rsp.ok) {
    console.warn("Failed to fetch latest notes:", rsp.status, rsp.statusText);
    return curr;
  }
  if (rsp.status === 304) {
    // no change
    console.log("No change in latest notes, returning cached version");
    return curr;
  }
  curr = await rsp.json();
  if (curr.Ver !== 1) {
    console.warn("Unexpected version of latest notes:", curr.Ver);
    return curr;
  }
  let notes = notesFromCompact(curr.Notes);
  s = JSON.stringify(curr, null, 2);
  localStorage.setItem(kKeyLatestNotes, s);
  return notes;
}

export async function createBackendStore() {
  let contentCacheStore = await AppendStore.create("cache_store");
  console.log(`cache_store has ${contentCacheStore.records.length} records`);
  let contentCache = new ContentCache(contentCacheStore);
  let store = new BackendStore(contentCache);
  return store;
}
