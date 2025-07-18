import { AppendStore } from "./appendstore";
import { Note } from "./note";
import { BackendStore, createBackendStore } from "./store-backend";
import { createLocalStore, LocalStore } from "./store-local";
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
  await store.createNote(noteId, name);
}

/**
 * @param {string} verId
 * @param {string} content
 */
export async function storeWriteNoteContent(verId, content) {
  await store.putString(verId, content);
}

/**
 * @param {string} contentId
 * @returns {Promise<string>}
 */
export async function storeGetString(contentId) {
  let res = await store.getString(contentId);
  return res;
}

/** @type { LocalStore } */
export let localStore;

/**
 * @returns {Promise<LocalStore>}
 */
export async function openLocalStore() {
  throwIf(store != undefined, "store already opened");
  localStore = await createLocalStore();
  store = localStore;
  return localStore;
}

export function closeLocalStore() {
  localStore = null;
  store = null;
}

/** @type { BackendStore } */
export let backendStore;

/**
 * @returns {Promise<BackendStore>}
 */
export async function openBackendStore() {
  backendStore = await createBackendStore();
  store = backendStore;
  return backendStore;
}
