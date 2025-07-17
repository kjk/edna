import { AppendStore, AppendStoreRecord, parseIndexCb } from "./appendstore";
import { Note, noteIdFromContentId } from "./note";
import { isDev, len, throwIf } from "./util";

// must match store.go
const kStoreCreateNote = "note-create";
const kStoreDeleteNote = "note-delete";
const kStoreSetNoteMeta = "note-meta";
const kStorePut = "put";
const kStorePutOverwrite = "put-o";

/**
 * @param {AppendStoreRecord[]} records
 * @param {string} key
 * @returns {AppendStoreRecord|null}
 */
function findPutRecord(records, key) {
  // searching from the end should be faster on average
  // we're more likely to search for recent content
  for (let idx = len(records) - 1; idx >= 0; idx--) {
    let rec = records[idx];
    if (rec.meta === key && rec.kind === kStorePut) {
      return rec;
    }
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
   * @returns {Promise<string>}
   */
  async getString(key) {
    let store = this.store;
    let rec = findPutRecord(store.records(), key);
    if (!rec) {
      return null; // no content found
    }
    let content = await store.readRecordAsString(rec);
    return content;
  }

  /**
   * @param {string} key
   * @param {string} content
   */
  async putString(key, content) {
    // console.log("putString:", key, content?.substring(0, 20));
    let store = this.store;
    await store.appendRecord(content, kStorePut, key);
    await debugValidateLocalStoreIndex();
  }

  async putStringOverwrite(key, content) {
    // console.log("putStringOverwrite:", key, content?.substring(0, 20));
    let store = this.store;
    await store.overWriteRecord(content, kStorePutOverwrite, key);
    await debugValidateLocalStoreIndex();
  }

  /**
   * @param {Object} m
   */
  async writeNoteMeta(m) {
    let store = this.store;
    // we expect m to be small so storing in index as meta
    let meta = JSON.stringify(m);
    await store.appendRecord(null, kStoreSetNoteMeta, meta);
    await debugValidateLocalStoreIndex();
  }

  /**
   * @param {string} fileName
   * @param {string} s
   */
  async writeStringToFile(fileName, s) {
    localStorage.setItem(fileName, s);
  }

  /**
   * @param {string} fileName
   * @returns {Promise<string>}
   */
  async readFileAsString(fileName) {
    return localStorage.getItem(fileName) || "";
  }

  /**
   * @param {string} noteId
   */
  async deleteNote(noteId) {
    let store = this.store;
    await store.appendRecord(null, kStoreDeleteNote, noteId);
    await debugValidateLocalStoreIndex();
  }

  /**
   * @param {string} noteId
   * @param {string} name
   */
  async createNote(noteId, name) {
    console.log("createNote:", noteId, name);
    let store = this.store;
    let meta = `${noteId}:${name}`;
    await store.appendRecord(null, kStoreCreateNote, meta);
    await debugValidateLocalStoreIndex();
  }
}

/**
 * @param {AppendStoreRecord[]} records
 * @returns {Note[]}
 */
export function notesFromStoreLog(records) {
  let res = [];
  let m = new Map();
  for (let rec of records) {
    if (rec.kind === kStoreCreateNote) {
      // meta is "noteId:name"
      let idx = rec.meta.indexOf(":");
      let noteId = rec.meta.substring(0, idx);
      let name = rec.meta.substring(idx + 1);
      let note = new Note(noteId, name);
      m.set(note.id, note);
    } else if (rec.kind === kStoreSetNoteMeta) {
      let meta = JSON.parse(rec.meta);
      let note = m.get(meta.id);
      if (!note) {
        console.warn("kStoreKindNoteMeta: no notefor meta record:", meta);
        continue;
      }
      note.applyMetadata(meta);
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
      let noteId = noteIdFromContentId(verId);
      let note = m.get(noteId);
      if (!note) {
        console.warn("kStorePut: no note for meta:", verId);
        continue;
      }
      note.versionIds.push(verId);
    }
  }
  for (let note of m.values()) {
    res.push(note);
  }
  return res;
}

let localStore;

export async function createLocalStore() {
  let apstore = await AppendStore.create("notes_store");
  console.log(`notes_store has ${apstore.records().length} records`);
  localStore = new LocalStore(apstore);
  return localStore;
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
      let noteId = noteIdFromContentId(verId);
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
    } else {
      throwIf(true, `Unknown record kind in index: ${k}, line: ${line}`);
    }
  });
}

export async function validateLocalStoreIndex() {
  throwIf(!localStore, "Local store is not initialized");
  let s = await localStore.store.getIndexAsString();
  try {
    validateIndex(s);
  } catch (e) {
    console.log(s);
    throw e;
  }
}

async function debugValidateLocalStoreIndex() {
  if (isDev()) {
    await validateLocalStoreIndex();
  }
}
