import { AppendStore, AppendStoreRecord } from "./appendstore";
import { len, throwIf } from "./util";

const kStoreKinewCreateNote = "note-create";
const kStoreKindNoteMeta = "note-meta";
const kStoreKindDeleteNote = "note-delete";
const kStoreKindNoteContent = "note-content";

/** @type {AppendStore} */
let store;

/**
 * @param {string} noteId
 * @returns {AppendStoreRecord|null}
 */
export function storeFindLatestNoteContentVersionRec(noteId) {
  let idx = len(store.records) - 1;
  let rec;
  // look for last note-content or note-delete
  while (idx >= 0) {
    rec = store.records[idx];
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

/**
 * @param {Object} m
 */
export async function storeWriteNoteMeta(m) {
  // we expect m to be small so storing in index as meta
  let meta = JSON.stringify(m);
  await store.write(null, kStoreKindNoteMeta, meta);
}

/**
 * @param {string} fileName
 * @param {string} s
 */
export async function storeWriteFileString(fileName, s) {
  localStorage.setItem(fileName, s);
}

/**
 * @returns {Promise<string>}
 */
export async function storeReadFileAsString(fileName) {
  return localStorage.getItem(fileName) || "";
}

/**
 * @param {string} noteId
 */
export async function storeMarkNoteDeleted(noteId) {
  await store.write(null, kStoreKindDeleteNote, noteId);
}

/**
 * @param {string} noteId
 * @param {string} name
 */
export async function storeCreateNote(noteId, name) {
  let meta = `${noteId}:${name}`;
  await store.write(null, kStoreKinewCreateNote, meta);
}

/**
 * @param {string} verId
 * @param {string} content
 */
export async function storeWriteContent(verId, content) {
  await store.write(content, kStoreKindNoteContent, verId);
}

/**
 * @param {string} noteId
 * @returns {Promise<string>}
 */
export async function storeLoadLatestNoteContent(noteId) {
  let rec = storeFindLatestNoteContentVersionRec(noteId);
  if (!rec) {
    return null; // no content found
  }
  let { offset, size } = rec;
  let content = await store.readString(offset, size);
  return content;
}

// convert falsy values to undefined so that JSON serialization
// doesn't include them, making the JSON smaller and easier to read
function toUndef(v) {
  return v ? v : undefined;
}

export class Note {
  /** @type {string} */
  id;
  /** @type {string} */
  name;
  /** @type {string[]} */
  versionIds = [];
  /** @type {boolean} */
  isArchived;
  /** @type {boolean} */
  isStarred;
  /** @type {string}  */
  altShortcut;

  getMetadata() {
    // by using toUndef() we make JSON-serialized version
    // smaller and easier to read
    return {
      id: this.id,
      name: this.name,
      isArchived: toUndef(this.isArchived),
      isStarred: toUndef(this.isStarred),
      altShortcut: toUndef(this.altShortcut),
    };
  }

  // reverse of getMetadata()
  // note that if a field in m is missing, it's false / undefined
  applyMetadata(m) {
    throwIf(this.id != m.id, "id mismatch");
    this.name = m.name;
    this.isArchived = m.isArchived;
    this.isStarred = m.isStarred;
    this.altShortcut = m.altShortcut;
  }

  constructor(id, name) {
    this.id = id;
    this.name = name;
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
    if (rec.kind === kStoreKinewCreateNote) {
      // meta is "noteId:name"
      let idx = rec.meta.indexOf(":");
      let noteId = rec.meta.substring(0, idx);
      let name = rec.meta.substring(idx + 1);
      let note = new Note(noteId, name);
      m.set(note.id, note);
    } else if (rec.kind === kStoreKindNoteMeta) {
      let meta = JSON.parse(rec.meta);
      let note = m.get(meta.id);
      note.applyMetadata(meta);
    } else if (rec.kind === kStoreKindDeleteNote) {
      let noteId = rec.meta;
      m.delete(noteId);
    } else if (rec.kind === kStoreKindNoteContent) {
      let verId = rec.meta; // verId is noteId:verId
      let noteId = rec.meta.split("-")[0];
      let note = m.get(noteId);
      note.versionIds.push(verId);
    }
  }
  for (let note of m.values()) {
    res.push(note);
  }
  return res;
}

/**
 * @returns {Promise<Note[]>}
 */
export async function openStore() {
  throwIf(store != undefined, "store already opened");
  store = await AppendStore.create("notes_store");
  console.log(`notes_store has ${store.records.length} records`);
  return notesFromStoreLog(store.records);
}
