import { AppendStore, AppendStoreRecord } from "./appendstore";
import { Note } from "./note";
import { kStorePut } from "./store-local";
import { len } from "./util";

/**
 *
 * @param {AppendStoreRecord[]} records
 * @param {string} key
 * @returns {AppendStoreRecord | null}
 */
function findPutRecord(records, key) {
  let n = len(records);
  for (let i = n - 1; i >= 0; i--) {
    let rec = records[i];
    if (rec.kind === kStorePut && rec.meta === key) {
      return rec;
    }
  }
  return null;
}

export class ContentCache {
  /** @type {AppendStore} */
  store;

  /**
   * @param {AppendStore} store
   */
  constructor(store) {
    this.store = store;
  }

  /**
   * @param {string} key
   * @returns {AppendStoreRecord|null}
   */
  findRecordForKey(key) {
    let recs = this.store.records();
    return findPutRecord(recs, key);
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.findRecordForKey(key) !== null;
  }

  /**
   * @param {string} key
   * @param {string|Uint8Array} value
   * @returns {Promise<void>}
   */
  async put(key, value) {
    await this.store.appendRecord(kStorePut, value, key);
  }

  /**
   * @param {string} key
   * @returns {Promise<string>}
   */
  async getAsString(key) {
    let rec = this.findRecordForKey(key);
    if (!rec) return null;
    return await this.store.readRecordAsString(rec);
  }
}

export class BackendStore {
  /** @type {ContentCache} */
  contentCache;

  /** @type {Note[]} */
  notes;

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
    // TODO: store in cache
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
    // check in cache first
    let cache = this.contentCache;
    let rec = findPutRecord(cache.store.records(), key);
    if (rec) {
      console.warn(`got ${key} from cache`);
      let s = cache.store.readRecordAsString(rec);
      return s;
    }
    let uri = "/api/store/getString?key=" + encodeURIComponent(key);
    let rsp = await fetch(uri);
    let s = await rsp.text();
    return s;
  }

  /**
   * @returns {Promise<Note[]>}
   */
  async getAllNotes() {
    if (this.notes) {
      return this.notes;
    }
    this.notes = await backendGetLatestNotes();
    // start a process to download content of all notes
    // TODO: do I need to await to ensure no race in file access?
    backendGetNotesContent(this.notes, this.contentCache);
    return this.notes;
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

/**
 * @param {any[][]} compactNotes
 * @returns {Note[]}
 */
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
    note.createdAt = n[4];
    note.updatedAt = n[5];
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

/**
 * @param {Note[]} notes
 * @param {ContentCache} cache
 * @returns {Promise<void>}
 */
async function backendGetNotesContent(notes, cache) {
  console.log("backendGetNotesContent");
  let neededVerIds = [];
  for (let note of notes) {
    let verId = note.currContentVersionId();

    if (!cache.has(verId)) {
      neededVerIds.push(verId);
    }
  }
  if (neededVerIds.length === 0) {
    console.warn("all notes are cached");
    return;
  }
  let arg = {
    VerIDs: neededVerIds,
  };
  let rsp = await fetch("/api/store/getNotesMultiContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(arg),
  });

  if (!rsp.ok) {
    console.warn("Failed to fetch latest notes:", rsp.status, rsp.statusText);
    return;
  }
  let zipBlob = await rsp.blob();
  let libZip = await import("@zip.js/zip.js");
  let blobReader = new libZip.BlobReader(zipBlob);
  let zipReader = new libZip.ZipReader(blobReader);
  let entries = await zipReader.getEntries();
  for (let entry of entries) {
    let u8writer = new libZip.Uint8ArrayWriter();
    await entry.getData(u8writer);
    let content = await u8writer.getData();
    await cache.put(entry.filename, content);
    console.warn(
      "cached verID:",
      entry.filename,
      "content:",
      len(content),
      " bytes",
    );
  }
}

export async function createBackendStore() {
  let contentCacheStore = await AppendStore.create("cache_store");
  console.log(`cache_store has ${contentCacheStore.records().length} records`);
  let contentCache = new ContentCache(contentCacheStore);
  let store = new BackendStore(contentCache);
  return store;
}
