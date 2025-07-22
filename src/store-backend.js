import {
  AppendStore,
  AppendStoreRecord,
  currTimestampMs,
  kFileSystemWorkerOFS,
  toBytes,
} from "./appendstore";
import { ofsListFiles } from "./fs-ofs";
import { createLocalStoreZip } from "./migrate-local-to-backend";
import { Note } from "./note";
import { findPutRecord, kStorePut, LocalStore } from "./store-local";
import { len } from "./util";

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
   * @returns {Promise<Uint8Array|null>}
   */
  async get(key) {
    let rec = this.findRecordForKey(key);
    return rec ? await this.store.readRecord(rec) : null;
  }
}

export class BackendStore {
  /** @type {ContentCache} */
  contentCache;
  /** @type {LocalStore} */
  offlineStore;

  /** @type {Note[]} */
  notes;

  /**
   * @param {ContentCache} contentCache
   * @param {LocalStore} offlineStore
   */
  constructor(contentCache, offlineStore) {
    this.contentCache = contentCache;
    this.offlineStore = offlineStore;
  }

  /**
   * @param {string} key
   * @returns {Promise<Uint8Array|null>}
   */
  async get(key) {
    // check in cache first
    let store = this.contentCache.store;
    let rec = findPutRecord(store.records(), key);
    if (rec) {
      console.warn(`got ${key} from cache`);
      return await store.readRecord(rec);
    }
    let uri = "/api/store/get?key=" + encodeURIComponent(key);
    let rsp = await fetch(uri);
    let d = await rsp.arrayBuffer();
    return new Uint8Array(d);
  }

  /**
   * @param {string} key
   * @param {string|Uint8Array} content
   */
  async put(key, content) {
    await this.flushOfflineChanges();

    let uri = "/api/store/put?key=" + encodeURIComponent(key);
    let body = toBytes(content);
    try {
      let rsp = await fetch(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: body,
      });
      console.log("rsp:", rsp);
      await this.contentCache.put(key, body);
      return;
    } catch (error) {
      console.error("Error putting key:", key, error);
    }
    await this.offlineStore.put(key, content);
    await this.contentCache.put(key, body);
  }

  /**
   * @param {string} fileName
   * @param {string | Uint8Array} content
   */
  async writeFile(fileName, content) {
    await this.flushOfflineChanges();

    let uri = "/api/store/writeFile?name=" + encodeURIComponent(fileName);
    let body = toBytes(content);

    try {
      let rsp = await fetch(uri, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: body,
      });
      console.log("rsp:", rsp);
      let fkey = "__file:" + fileName;
      await this.contentCache.put(fkey, body);
      return;
    } catch (error) {
      console.error("Error writing file:", fileName, error);
    }
    await this.offlineStore.writeFile(fileName, content);
  }

  /**
   * @param {string} fileName
   * @returns {Promise<Uint8Array|null>}
   */
  async readFile(fileName) {
    // TODO: what scenarios could lead to reading stale data?
    let fkey = "__file:" + fileName;
    let body = await this.contentCache.get(fkey);
    if (body) {
      return body;
    }

    let uri = "/api/store/readFile?name=" + encodeURIComponent(fileName);
    let ab;
    try {
      let rsp = await fetch(uri);
      if (rsp.status === 404) {
        console.warn(`File ${fileName} not found`);
        return null;
      }
      if (!rsp.ok) {
        console.warn("readFile error:", rsp.status, rsp.statusText);
        return null;
      }
      ab = await rsp.arrayBuffer();
      let res = new Uint8Array(ab);
      await this.contentCache.put(fkey, res);
      return res;
    } catch (e) {
      console.warn("readFile error:", e);
    }
    return null;
  }

  /**
   * @param {Object} m
   */
  async writeNoteMeta(m) {
    await this.flushOfflineChanges();

    let meta = encodeURIComponent(JSON.stringify(m));
    let uri = "/api/store/writeNoteMeta?meta=" + meta;
    try {
      let rsp = await fetch(uri);
      console.log("writeNoteMeta rsp:", rsp);
      // TODO: update metadata for this note
      return;
    } catch (e) {
      console.error("writeNoteMeta error:", e);
    }

    await this.offlineStore.writeNoteMeta(m);
  }

  /**
   * @param {string} noteId
   */
  async deleteNote(noteId) {
    await this.flushOfflineChanges();

    let uri = "/api/store/deleteNote?noteId=" + noteId;
    try {
      let rsp = await fetch(uri);
      console.log("deleteNote rsp:", rsp);
      let notes = this.notes;
      for (let i = 0; i < notes.length; i++) {
        if (notes[i].id === noteId) {
          notes.splice(i, 1);
          break;
        }
      }
      return;
    } catch (e) {
      console.error("deleteNote error:", e);
    }

    await this.offlineStore.deleteNote(noteId);
  }

  /**
   * @param {string} noteId
   * @param {string} name
   * @return {Promise<Note>}
   */
  async createNote(noteId, name) {
    await this.flushOfflineChanges();

    let encName = encodeURI(name);
    let uri = "/api/store/createNote?noteId=" + noteId + "&name=" + encName;
    try {
      let rsp = await fetch(uri);
      console.log("createNote rsp:", rsp);
      let note = new Note(noteId, name);
      note.createdAt = currTimestampMs();
      note.updatedAt = note.createdAt;
      this.notes.push(note);
      return note;
    } catch (e) {
      console.error("createNote error:", e);
    }

    let note = await this.offlineStore.createNote(noteId, name);
    this.notes.push(note);
    return note;
  }

  /**
   * @returns {Promise<Note[]>}
   */
  async getAllNotes() {
    if (this.notes) {
      return this.notes;
    }
    this.notes = await getLatestNotes();
    // start a process to download content of all notes
    // TODO: do I need to await to ensure no race in file access?
    cacheLatestNoteVersions(this.notes, this.contentCache);
    return this.notes;
  }

  /**
   * @returns {Promise<void>}
   */
  async flushOfflineChanges() {
    let store = this.offlineStore.store;
    let recs = store.records();
    if (len(recs) === 0) {
      return;
    }
    // not sure if should do this check or just go ahead and try
    // the actual operation?
    let isOnline = await isOnlineForSure();
    if (!isOnline) {
      return;
    }
    await uploadOfflineStore(this.offlineStore);
    await deleteOfflineStore();
    this.notes = null;
    await this.getAllNotes();
  }
}

export async function isOnlineForSure() {
  let uri = "/ping";
  try {
    let rsp = await fetch(uri);
    if (!rsp.ok) {
      console.error("isOnlineForSure failed:", rsp.status);
      return false;
    }
    let s = await rsp.text();
    return s == "pong";
  } catch (e) {
    console.error("isOnlineForSure error:", e);
    return false;
  }
}

/**
 * @param {LocalStore} localStore
 * @returns
 */
async function uploadOfflineStore(localStore) {
  const blob = await createLocalStoreZip(localStore, false);
  if (!blob) {
    return;
  }
  let uri = "/api/store/uploadOfflineChanges";
  try {
    let rsp = await fetch(uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    });
    console.warn("uploadOfflineStore: rsp:", rsp);
    // const root = await navigator.storage.getDirectory();
    // root.removeEntry(indexFileName);
    // root.removeEntry(dataFileName);
  } catch (e) {
    console.error("uploadOfflineStore: error uploading append store zip:", e);
  }
  await deleteOfflineStore();
  await ofsListFiles();
  console.warn("uploadOfflineStore: migration completed");
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
async function getLatestNotes() {
  console.log("getLatestNotes");
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
async function cacheLatestNoteVersions(notes, cache) {
  console.log("cacheLatestNoteVersions");
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

async function deleteOfflineStore() {
  await AppendStore.create("offline_store", kFileSystemWorkerOFS, true);
}

export async function createBackendStore() {
  let contentCacheStore = await AppendStore.create("cache_store");
  console.log(`cache_store has ${contentCacheStore.records().length} records`);
  let contentCache = new ContentCache(contentCacheStore);
  let offlineStoreStore = await AppendStore.create(
    "offline_store",
    kFileSystemWorkerOFS,
    false,
  );
  let offlineStore = new LocalStore(offlineStoreStore);
  offlineStore.isPartial = true;
  let store = new BackendStore(contentCache, offlineStore);
  return store;
}
