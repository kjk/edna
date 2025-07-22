import { AppendStore } from "./appendstore";
import { Note } from "./note";
import { BackendStore, createBackendStore } from "./store-backend";
import { createLocalStore, LocalStore } from "./store-local";
import { throwIf } from "./util";

/** @type { LocalStore | BackendStore } */
let store;

let utf8Decoder = new TextDecoder();

/**
 * @param {Object} m
 */
export async function storeWriteNoteMeta(m) {
  await store.writeNoteMeta(m);
}

/**
 * @param {string} fileName
 * @param {string|Uint8Array} s
 */
export async function storeWriteFile(fileName, s) {
  await store.writeFile(fileName, s);
}

/**
 * @param {string} fileName
 * @returns {Promise<string>}
 */
export async function storeReadFileAsString(fileName) {
  let data = await store.readFile(fileName);
  return data ? utf8Decoder.decode(data) : null;
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
 * @returns {Promise<Note>}
 */
export async function storeCreateNote(noteId, name) {
  return await store.createNote(noteId, name);
}

/**
 * @param {string} verId
 * @param {string} content
 */
export async function storeWriteNoteContent(verId, content) {
  await store.put(verId, content);
}

/**
 * @param {string} contentId
 * @returns {Promise<Uint8Array|null>}
 */
export async function storeGet(contentId) {
  return await store.get(contentId);
}

/**
 * @param {string} contentId
 * @returns {Promise<string>}
 */
export async function storeGetString(contentId) {
  let res = await store.get(contentId);
  return res ? utf8Decoder.decode(res) : null;
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
