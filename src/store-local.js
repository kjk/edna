import {
  AppendStore,
  AppendStoreRecord,
  kFileSystemWorkerOFS,
  parseIndexCb,
} from "./appendstore";
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
  for (let idx = lastIdx; idx >= 0; idx--) {
    let rec = records[idx];
    if (rec.kind !== kStoreWriteFile) {
      continue;
    }
    let m = JSON.parse(rec.meta);
    if (m?.name !== name) {
      continue;
    }
    return rec;
  }
  return null;
}

export class LocalStore {
  /** @type {AppendStore} */
  store;

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
    await store.appendRecord(kStorePut, content, key);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} name
   * @param {string |Uint8Array} content
   */
  async writeFile(name, content) {
    // console.log("putStringOverwrite:", meta, content?.substring(0, 20));
    let store = this.store;
    let meta = JSON.stringify({
      name: name,
    });
    await store.overWriteRecord(content, kStoreWriteFile, meta);
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
    await store.appendRecord(kStoreSetNoteMeta, null, meta);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} noteId
   */
  async deleteNote(noteId) {
    let store = this.store;
    await store.appendRecord(kStoreDeleteNote, null, noteId);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @param {string} noteId
   * @param {string} name
   */
  async createNote(noteId, name) {
    // console.log("createNote:", noteId, name);
    let store = this.store;
    let meta = `${noteId}:${name}`;
    await store.appendRecord(kStoreCreateNote, null, meta);
    await debugValidateLocalStoreIndex(this);
  }

  /**
   * @returns {Promise<Note[]>}
   */
  async getAllNotes() {
    let store = this.store;
    return notesFromStoreLog(store.records());
  }
}

/**
 * @param {AppendStoreRecord[]} records
 * @returns {Note[]}
 */
function notesFromStoreLog(records) {
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
      m.set(note.id, note);
    } else if (rec.kind === kStoreSetNoteMeta) {
      let meta = JSON.parse(rec.meta);
      let note = m.get(meta.id);
      if (!note) {
        console.warn("kStoreKindNoteMeta: no notefor meta record:", meta);
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
        console.warn("kStoreKindDeleteNote: no note for meta:", rec.meta);
        continue;
      }
      m.delete(noteId);
    } else if (rec.kind === kStorePut) {
      let verId = rec.meta; // verId is noteId:verId
      let noteId = noteIdFromVerId(verId);
      let note = m.get(noteId);
      if (!note) {
        console.warn("kStorePut: no note for meta:", verId);
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

export async function createLocalStore() {
  let apstore = await AppendStore.create(
    "notes_store",
    kFileSystemWorkerOFS,
    false,
  );
  console.log(`notes_store has ${apstore.records().length} records`);
  return new LocalStore(apstore);
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
