import { AppendStore, AppendStoreRecord } from "./appendstore";
import { len } from "./util";

/** @type {AppendStore} */
let store;

export async function openStore() {
  if (store) {
    return store; // already opened
  }
  store = await AppendStore.create("notes_store");
  console.log(`notes_store has ${store.records.length} records`);
  return store;
}

const kStoreKinewCreateNote = "note-create";
const kStoreKindNoteMeta = "note-meta";
const kStoreKindDeleteNote = "note-delete";
const kStoreKindNoteContent = "note-content";
const kStoreKindAppMeta = "app-meta";

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
  let store = await openStore();
  // we expect m to be small so storing in index as meta
  let meta = JSON.stringify(m);
  await store.write(null, kStoreKindNoteMeta, meta);
}

/**
 * @param {Object} m
 */
export async function storeWriteAppMeta(m) {
  let store = await openStore();
  let meta = JSON.stringify(m);
  await store.write(meta, kStoreKindAppMeta, null);
}

function getLastRecordOfKind(store, kind) {
  let lastRecord = null;
  for (let record of store.records) {
    if (record.kind === kind) {
      lastRecord = record; // we expect only one app meta record
    }
  }
  return lastRecord;
}

export async function readAppMeta() {
  let store = await openStore();
  let rec = getLastRecordOfKind(store, kStoreKindAppMeta);
  if (!rec) {
    return null; // no app metadata
  }
  let meta = await store.readString(rec.offset, rec.length);
  return meta;
}

/**
 * @param {string} noteId
 */
export async function storeMarkNoteDeleted(noteId) {
  let store = await openStore();
  await store.write(null, kStoreKindDeleteNote, noteId);
}

/**
 * @param {string} noteId
 * @param {Object} meta
 */
export async function storeCreateNote(noteId, meta) {
  let store = await openStore();
  let metaStr = JSON.stringify(meta);
  await store.write(metaStr, kStoreKinewCreateNote, noteId);
}

/**
 * @param {string} verId
 * @param {string} content
 */
export async function storeWriteContent(verId, content) {
  let store = await openStore();
  await store.write(content, kStoreKindNoteContent, verId);
}

/**
 * @param {string} noteId
 * @returns {Promise<string>}
 */
export async function storeLoadLatestNoteContent(noteId) {
  let store = await openStore();
  let rec = storeFindLatestNoteContentVersionRec(noteId);
  if (!rec) {
    return null; // no content found
  }
  let { offset, size } = rec;
  let content = await store.readString(offset, size);
  return content;
}
