import {
  AppendStore,
  AppendStoreRecord,
  kFileSystemWorkerOFS,
  parseIndexCb,
} from "./appendstore";
import { keyValueMarshal, keyValueUnmarshal } from "./appendstore_kv";
import { Note, noteIdFromVerId } from "./note";
import { isDev, len, throwIf } from "./util";

// must match store.go
const kStoreCreateNote = "note-create";
const kStoreDeleteNote = "note-delete";
const kStoreSetNoteMeta = "note-meta";
export const kStorePut = "put";
const kStoreWriteFile = "write-file";

/**
 * @param {AppendStoreRecord[]} records
 * @param {string} key
 * @returns {AppendStoreRecord|null}
 */
export function findPutRecord(records, key) {
  // searching from the end should be faster on average
  // we're more likely to search for recent content
  let lastIdx = len(records) - 1;
  for (let idx = lastIdx; idx >= 0; idx--) {
    let rec = records[idx];
    if (rec.kind !== kStorePut) {
      continue;
    }
    if (rec.meta !== key) {
      continue;
    }
    return rec;
  }
  return null;
}

/**
 * @param {AppendStoreRecord[]} records
 * @param {string} name
 * @returns {AppendStoreRecord|null}
 */
export function findWriteFileRecord(records, name) {
  // searching from the end should be faster on average
  // we're more likely to search for recent content
  let lastIdx = len(records) - 1;
  let meta = keyValueMarshal("name", name);
  for (let idx = lastIdx; idx >= 0; idx--) {
    let rec = records[idx];
    if (rec.kind !== kStoreWriteFile) {
      continue;
    }
    if (!rec.meta.includes(meta)) {
      // fast negative check
      continue;
    }
    let kv = keyValueUnmarshal(rec.meta);
    for (let i = 0; i < kv.length; i += 2) {
      if (kv[i] === "name" && kv[i + 1] === name) {
        return rec;
      }
    }
    return rec;
  }
  return null;
}

export class LocalStore {
  /** @type {AppendStore} */
  store;

  // if true, this is a partial store used to store changes
  // when we're offline
  isPartial = false;

  /**
   * @param {AppendStore} apstore
   */
  constructor(apstore) {
    this.store = apstore;
  }

  /**
   * @param {string} key
   * @returns {Promise<Uint8Array|null>} returns null if doesn't exist
   */
  async get(key) {
    let store = this.store;
    let rec = findPutRecord(store.records(), key);
    let content = rec ? await store.readRecord(rec) : null;
    return content;
  }

  /**
   * @param {string} key
   * @param {string|Uint8Array} content
   */
  async put(key, content) {
    // console.log("putString:", key, content?.substring(0, 20));
    let store = this.store;
    await store.appendRecord(kStorePut, key, content);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} name
   * @param {string |Uint8Array} content
   */
  async writeFile(name, content) {
    // console.log("putStringOverwrite:", meta, content?.substring(0, 20));
    let store = this.store;
    let meta = keyValueMarshal("name", name);
    await store.overWriteRecord(kStoreWriteFile, meta, content);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} fileName
   * @returns {Promise<Uint8Array>}
   */
  async readFile(fileName) {
    let store = this.store;
    let rec = findWriteFileRecord(store.records(), fileName);
    return rec ? await store.readRecord(rec) : null;
  }

  /**
   * @param {Object} m
   */
  async writeNoteMeta(m) {
    let store = this.store;
    // we expect m to be small so storing in index as meta
    let meta = JSON.stringify(m);
    await store.appendRecord(kStoreSetNoteMeta, meta, null);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} noteId
   */
  async deleteNote(noteId) {
    let store = this.store;
    await store.appendRecord(kStoreDeleteNote, noteId, null);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} noteId
   * @param {string} name
   * @return {Promise<Note>}
   */
  async createNote(noteId, name) {
    // console.log("createNote:", noteId, name);
    let store = this.store;
    let meta = `${noteId}:${name}`;
    await store.appendRecord(kStoreCreateNote, meta, null);
    await debugValidateLocalStoreIndex(this);
    let notes = await this.getAllNotes();
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].id === noteId) {
        return notes[i];
      }
    }
    throw new Error(
      `createNote: note not found after being created: id:${noteId} name:${name}`,
    );
  }

  /**
   * @returns {Promise<Note[]>}
   */
  async getAllNotes() {
    let store = this.store;
    return notesFromStoreLog(store.records(), this.isPartial);
  }
}

/**
 * @param {AppendStoreRecord[]} records
 * @param {boolean} isPartial
 * @returns {Note[]}
 */
function notesFromStoreLog(records, isPartial) {
  let res = [];
  let m = new Map();
  for (let rec of records) {
    if (rec.kind === kStoreCreateNote) {
      // meta is "noteId:name"
      let idx = rec.meta.indexOf(":");
      let noteId = rec.meta.substring(0, idx);
      let name = rec.meta.substring(idx + 1);
      let note = new Note(noteId, name);
      note.createdAt = rec.timestampMs;
      note.updatedAt = note.createdAt;
      m.set(note.id, note);
    } else if (rec.kind === kStoreSetNoteMeta) {
      let meta = JSON.parse(rec.meta);
      let note = m.get(meta.id);
      if (!note) {
        if (!isPartial) {
          console.warn("kStoreKindNoteMeta: no notefor meta record:", meta);
        }
        continue;
      }
      if (meta.altShortcut !== "") {
        for (let n of m.values()) {
          if (n.altShortcut === meta.altShortcut) {
            n.altShortcut = "";
          }
        }
        note.altShortcut = meta.altShortcut;
      }
      note.applyMetadata(meta);
      note.updatedAt = rec.timestampMs;
    } else if (rec.kind === kStoreDeleteNote) {
      let noteId = rec.meta;
      let note = m.get(noteId);
      if (!note) {
        if (!isPartial) {
          console.warn("kStoreKindDeleteNote: no note for meta:", rec.meta);
        }
        continue;
      }
      m.delete(noteId);
    } else if (rec.kind === kStorePut) {
      let verId = rec.meta; // verId is noteId:verId
      let noteId = noteIdFromVerId(verId);
      let note = m.get(noteId);
      if (!note) {
        if (!isPartial) {
          console.warn("kStorePut: no note for meta:", verId);
        }
        continue;
      }
      note.versionIds.push(verId);
      note.updatedAt = rec.timestampMs;
    } else if (rec.kind === kStoreWriteFile) {
      // do nothing
    }
  }
  for (let note of m.values()) {
    res.push(note);
  }
  return res;
}

const kLocalStorePrefix = "notes_store";
const kLocalStoreFS = kFileSystemWorkerOFS;

export async function createLocalStore() {
  let apstore = await AppendStore.create(
    kLocalStorePrefix,
    kLocalStoreFS,
    false,
  );
  console.log(`${kLocalStorePrefix} has ${apstore.records().length} records`);
  return new LocalStore(apstore);
}

export async function deleteLocalStore() {
  let apstore = await AppendStore.create(
    kLocalStorePrefix,
    kLocalStoreFS,
    true,
  );
}

/**
 * @param {string} s
 */
export function validateIndex(s) {
  let m = new Set(); // remembers non-deleted notes
  parseIndexCb(s, (line, record) => {
    let k = record.kind;
    let meta = record.meta;
    if (k === kStoreCreateNote) {
      let noteId = meta.split(":")[0];
      throwIf(
        m.has(noteId),
        `Duplicate note id in index: ${noteId}, line: ${line}`,
      );
      m.add(noteId);
    } else if (k === kStoreDeleteNote) {
      let noteId = meta;
      throwIf(
        !m.has(noteId),
        `Deleting non-existing note: ${noteId}, line: ${line}`,
      );
      m.delete(noteId);
    } else if (k === kStorePut) {
      let verId = meta; // verId is noteId:verId
      let noteId = noteIdFromVerId(verId);
      throwIf(
        !m.has(noteId),
        `Putting non-existing note: ${noteId}, line: ${line}`,
      );
    } else if (k === kStoreSetNoteMeta) {
      let json = JSON.parse(meta);
      let noteId = json.id;
      throwIf(
        !m.has(noteId),
        `Setting meta for non-existing note: ${noteId}, line: ${line}`,
      );
    } else if (k === kStoreWriteFile) {
      // do nothing
    } else {
      throwIf(true, `Unknown record kind in index: ${k}, line: ${line}`);
    }
  });
}

/**
 * @param {LocalStore} localStore
 */
async function validateLocalStoreIndex(localStore) {
  if (localStore.isPartial) {
    // partial store cannot be validated
    return;
  }
  let s = await localStore.store.getIndexAsString();
  try {
    validateIndex(s);
  } catch (e) {
    console.log(s);
    throw e;
  }
}

/**
 * @param {LocalStore} localStore
 */
async function debugValidateLocalStoreIndex(localStore) {
  if (isDev()) {
    await validateLocalStoreIndex(localStore);
  }
}
