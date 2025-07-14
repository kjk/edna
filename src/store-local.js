import { AppendStore, AppendStoreRecord } from "./appendstore";
import { Note, noteIdFromContentId } from "./note";
import { len } from "./util";

const kStoreCreateNote = "note-create";
const kStoreKindNoteMeta = "note-meta";
const kStoreKindDeleteNote = "note-delete";
const kStoreKindNoteContent = "note-content";

/**
 * @param {AppendStoreRecord[]} records
 * @param {string} noteId
 * @returns {AppendStoreRecord|null}
 */
function apstoreFindLatestNoteContentVersionRec(records, noteId) {
  let idx = len(records) - 1;
  let rec;
  // look for last note-content or note-delete
  while (idx >= 0) {
    rec = records[idx];
    if (rec.kind === kStoreKindDeleteNote) {
      if (rec.meta == noteId) {
        return null;
      }
    } else if (rec.kind == kStoreKindNoteContent) {
      if (rec.meta.startsWith(noteId)) {
        return rec;
      }
    }
    idx--;
    continue;
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
   * @param {string} noteId
   * @returns
   */
  async loadLatestNoteContent(noteId) {
    let store = this.store;
    let rec = apstoreFindLatestNoteContentVersionRec(store.records, noteId);
    if (!rec) {
      return null; // no content found
    }
    let { offset, size } = rec;
    let content = await store.readString(offset, size);
    return content;
  }

  /**
   * @param {string} verId
   * @param {string} content
   */
  async writeNoteContent(verId, content) {
    let store = this.store;
    let meta = verId;
    await store.appendRecord(content, kStoreKindNoteContent, meta);
  }

  /**
   * @param {Object} m
   */
  async writeNoteMeta(m) {
    let store = this.store;
    // we expect m to be small so storing in index as meta
    let meta = JSON.stringify(m);
    await store.appendRecord(null, kStoreKindNoteMeta, meta);
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
    await store.appendRecord(null, kStoreKindDeleteNote, noteId);
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
    } else if (rec.kind === kStoreKindNoteMeta) {
      let meta = JSON.parse(rec.meta);
      let note = m.get(meta.id);
      if (!note) {
        console.warn("kStoreKindNoteMeta: no notefor meta record:", meta);
        continue;
      }
      note.applyMetadata(meta);
    } else if (rec.kind === kStoreKindDeleteNote) {
      let noteId = rec.meta;
      let note = m.get(noteId);
      if (!note) {
        console.warn("kStoreKindDeleteNote: no note for meta:", rec.meta);
        continue;
      }
      m.delete(noteId);
    } else if (rec.kind === kStoreKindNoteContent) {
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
