import { AppendStore } from "./appendstore";

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

const kStoreKindNoteMeta = "note-meta";
const kStoreKindDeleteNote = "note-delete";
const kStoreKindAppMeta = "app-meta";

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
