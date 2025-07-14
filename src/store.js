import { AppendStore } from "./appendstore";
import { Note } from "./note";
import { BackendStore } from "./store-backend";
import { createLocalStore, LocalStore, notesFromStoreLog } from "./store-local";
import { throwIf } from "./util";

/** @type { LocalStore | BackendStore } */
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
  return store.readFileAsString(fileName);
}

/**
 * @param {string} noteId
 */
export async function storeDeleteNote(noteId) {
  await store.deleteNote(noteId);
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
export async function storeWriteNoteContent(verId, content) {
  await store.writeNoteContent(verId, content);
}

/**
 * @param {string} noteId
 * @returns {Promise<string>}
 */
export async function storeLoadLatestNoteContent(noteId) {
  let res = await store.loadLatestNoteContent(noteId);
  return res;
}

/**
 * @returns {Promise<Note[]>}
 */
export async function openLocalStore() {
  throwIf(store != undefined, "store already opened");
  let localStore = await createLocalStore();
  store = localStore;
  return notesFromStoreLog(localStore.store.records);
}

export function openBackendStore() {}
