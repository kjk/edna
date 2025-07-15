import { AppendStore, AppendStoreRecord } from "./appendstore";
import { Note, noteIdFromContentId } from "./note";
import { len } from "./util";

const kStoreCreateNote = "note-create";
const kStoreDeleteNote = "note-delete";
const kStoreSetNoteMeta = "note-meta";
const kStorePut = "put";

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
    if (rec.kind === kStorePut) {
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
    let rec = findPutRecord(store.records, key);
    if (!rec) {
      return null; // no content found
    }
    let { offset, size } = rec;
    let content = await store.readString(offset, size);
    return content;
  }

  /**
   * @param {string} key
   * @param {string} content
   */
  async putString(key, content) {
    let store = this.store;
    let meta = key;
    await store.appendRecord(content, kStorePut, meta);
  }

  /**
   * @param {Object} m
   */
  async writeNoteMeta(m) {
    let store = this.store;
    // we expect m to be small so storing in index as meta
    let meta = JSON.stringify(m);
    await store.appendRecord(null, kStoreSetNoteMeta, meta);
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
  }

  /**
   * @param {string} noteId
   * @param {string} name
   */
  async createNote(noteId, name) {
    let store = this.store;
    let meta = `${noteId}:${name}`;
    await store.appendRecord(null, kStoreCreateNote, meta);
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
        console.warn("kStoreKindNoteContent: no note for meta:", verId);
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

export async function createLocalStore() {
  let apstore = await AppendStore.create("notes_store");
  console.log(`notes_store has ${apstore.records.length} records`);
  let store = new LocalStore(apstore);
  return store;
}
