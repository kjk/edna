import { AppendStore } from "./appendstore";
import { Note } from "./note";

export class ContentCache {
  /** @type {AppendStore} */
  store;

  /**
   * @param {AppendStore} store
   */
  constructor(store) {
    this.store = store;
  }
}

export class BackendStore {
  /** @type {ContentCache} */
  contentCache;

  /**
   * @param {ContentCache} contentCache
   */
  constructor(contentCache) {
    this.contentCache = contentCache;
  }

  /**
   * @param {Object} m
   */
  async writeNoteMeta(m) {
    let meta = JSON.stringify(m);
    let uri = "/api/store/writeNoteMeta?meta=" + encodeURIComponent(meta);
    let rsp = await fetch(uri);
    console.log("writeNoteMeta rsp:", rsp);
  }

  /**
   * @param {string} fileName
   * @param {string} content
   */
  async writeStringToFile(fileName, content) {
    let uri =
      "/api/store/writeStringToFile?fileName=" + encodeURIComponent(fileName);
    let boddy = new TextEncoder().encode(content);
    let rsp = await fetch(uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: boddy,
    });
    console.log("rsp:", rsp);
  }

  /**
   * @param {string} fileName
   * @returns {Promise<string>}
   */
  async readFileAsString(fileName) {
    let uri =
      "/api/store/readFileAsString?fileName=" + encodeURIComponent(fileName);
    let s = "";
    try {
      let rsp = await fetch(uri);
      if (rsp.status === 404) {
        console.warn(`File ${fileName} not found`);
        return "";
      }
      if (!rsp.ok) {
        console.warn("readFileAsString error:", rsp.status, rsp.statusText);
        return "";
      }
      s = await rsp.text();
    } catch (e) {
      console.warn("readFileAsString error:", e);
    }
    return s;
  }

  /**
   * @param {string} noteId
   */
  async deleteNote(noteId) {
    let uri = "/api/store/deleteNote?noteId=" + noteId;
    let rsp = await fetch(uri);
    console.log("deleteNote rsp:", rsp);
  }

  /**
   * @param {string} noteId
   * @param {string} name
   */
  async createNote(noteId, name) {
    let uri =
      "/api/store/createNote?noteId=" +
      noteId +
      "&name=" +
      encodeURIComponent(name);
    let rsp = await fetch(uri);
    console.log("createNote rsp:", rsp);
  }

  /**
   * @param {string} key
   * @param {string} content
   */
  async putString(key, content) {
    let uri = "/api/store/putString?key=" + encodeURIComponent(key);
    let boddy = new TextEncoder().encode(content);
    let rsp = await fetch(uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: boddy,
    });
    console.log("rsp:", rsp);
  }

  /**
   * @param {string} key
   * @returns {Promise<string>}
   */
  async getString(key) {
    let uri = "/api/store/getString?key=" + encodeURIComponent(key);
    let rsp = await fetch(uri);
    let s = await rsp.text();
    return s;
  }

  /**
   * @returns {Promise<Note[]>}
   */
  async getAllNotes() {
    return await backendGetLatestNotes();
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
    NotesCompact: [],
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

/**
 * @returns {Promise<Note[]>}
 */
async function backendGetLatestNotes() {
  console.log("backendGetLatestNotes");
  let s = localStorage.getItem(kKeyLatestNotes);
  let curr = parseLatestNotes(s);
  let notes = notesFromCompact(curr.NotesCompact);
  let rsp = await fetch(
    "/api/store/getNotes?lastChangeID=" + curr.LastChangeID,
  );
  // must check before rsp.ok because it's false for 304 (seems wrong)
  if (rsp.status === 304) {
    // no change
    console.log("No change in latest notes, returning cached version");
    return notes;
  }
  if (!rsp.ok) {
    console.warn("Failed to fetch latest notes:", rsp.status, rsp.statusText);
  }
  curr = await rsp.json();
  if (curr.Ver !== 1) {
    console.warn("Unexpected version of latest notes:", curr.Ver);
    return notes;
  }
  notes = notesFromCompact(curr.NotesCompact);
  s = JSON.stringify(curr, null, 2);
  localStorage.setItem(kKeyLatestNotes, s);
  return notes;
}

export async function createBackendStore() {
  let contentCacheStore = await AppendStore.create("cache_store");
  console.log(`cache_store has ${contentCacheStore.records().length} records`);
  let contentCache = new ContentCache(contentCacheStore);
  let store = new BackendStore(contentCache);
  return store;
}
