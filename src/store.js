import { AppendStore, AppendStoreRecord } from "./appendstore";
import { len, throwIf } from "./util";

const kStoreKinewCreateNote = "note-create";
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

class LocalStore {
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
  async writeContent(verId, content) {
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
  async storeReadFileAsString(fileName) {
    return localStorage.getItem(fileName) || "";
  }
  /**
   * @param {string} noteId
   */
  async storeDeleteNote(noteId) {
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
    await store.appendRecord(null, kStoreKinewCreateNote, meta);
  }
}

/** @type { LocalStore } */
let store;

/**
 * @param {Object} m
 */
export async function storeWriteNoteMeta(m) {
  await store.writeNoteMeta(m);
}

/**
 * @param {string} fileName
 * @param {string} s
 */
export async function storeWriteStringToFile(fileName, s) {
  await store.writeStringToFile(fileName, s);
}

/**
 * @param {string} fileName
 * @returns {Promise<string>}
 */
export async function storeReadFileAsString(fileName) {
  return store.storeReadFileAsString(fileName);
}

/**
 * @param {string} noteId
 */
export async function storeDeleteNote(noteId) {
  await store.storeDeleteNote(noteId);
}

/**
 * @param {string} noteId
 * @param {string} name
 */
export async function storeCreateNote(noteId, name) {
  store.createNote(noteId, name);
}

/**
 * @param {string} verId
 * @param {string} content
 */
export async function storeWriteContent(verId, content) {
  await store.writeContent(verId, content);
}

/**
 * @param {string} noteId
 * @returns {Promise<string>}
 */
export async function storeLoadLatestNoteContent(noteId) {
  let res = await store.loadLatestNoteContent(noteId);
  return res;
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
export async function openLocalStore() {
  throwIf(store != undefined, "store already opened");
  let apstore = await AppendStore.create("notes_store");
  console.log(`notes_store has ${apstore.records.length} records`);
  store = new LocalStore(apstore);
  return notesFromStoreLog(apstore.records);
}

/**
 * @param {any} libZip
 * @param {any} zipWriter
 * @param {string} fileName
 * @param {Blob} fileBlob
 */
async function addBinaryBlob(libZip, zipWriter, fileName, fileBlob) {
  let blobReader = new libZip.BlobReader(fileBlob);
  let opts = {
    level: 9,
  };
  await zipWriter.add(fileName, blobReader, opts);
}

export async function getAppendStoreZip(indexFileName, dataFileName) {
  const root = await navigator.storage.getDirectory();

  let libZip = await import("@zip.js/zip.js");
  let blobWriter = new libZip.BlobWriter("application/zip");
  let zipWriter = new libZip.ZipWriter(blobWriter);
  try {
    const indexHandle = await root.getFileHandle(indexFileName);
    const file = await indexHandle.getFile();
    if (file.size === 0) {
      console.warn("getAppendStoreZip: index file is empty, skipping");
      return null;
    }
    const buffer = await file.arrayBuffer();
    addBinaryBlob(libZip, zipWriter, "index.txt", new Blob([buffer]));
  } catch (e) {
    console.warn("getAppendStoreZip: error reading index file:", e);
    return null;
  }
  try {
    const dataHandle = await root.getFileHandle(dataFileName);
    const file = await dataHandle.getFile();
    const buffer = await file.arrayBuffer();
    addBinaryBlob(libZip, zipWriter, "data.bin", new Blob([buffer]));
  } catch (e) {
    console.warn("getAppendStoreZip: error reading data file:", e);
    return null;
  }
  let blob = await zipWriter.close();
  return blob;
}

export async function maybeUploadAppendStoreZip() {
  debugger;
  let indexFileName = "notes_store_index.txt";
  let dataFileName = "notes_store_data.bin";
  let blob = await getAppendStoreZip(indexFileName, dataFileName);
  try {
    let rsp = await fetch("/api/store/bulkUpload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    });
    console.warn("uploadAppenStoreZip: rsp:", rsp);
    // const root = await navigator.storage.getDirectory();
    // root.removeEntry(indexFileName);
    // root.removeEntry(dataFileName);
  } catch (e) {
    console.error(
      "maybeUploadAppendStoreZip: error uploading append store zip:",
      e,
    );
    throw e;
  }
}
