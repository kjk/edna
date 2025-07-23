import { decryptBlobAsString, encryptStringAsBlob } from "kiss-crypto";
import { AppendStore } from "./appendstore";
import {
  getPasswordHash,
  getPasswordHashMust,
  kLSPassowrdKey,
  removePassword,
} from "./encrypt";
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
  let pwdHash = getPasswordHash();
  if (!pwdHash) {
    await store.put(verId, content, false);
    return;
  }
  let d = encryptStringAsBlob({ key: pwdHash, plaintext: content });
  await store.put(verId, content, true);
}

/**
 * TODO: test returning null and handle that in the UI
 * @param {string} contentId
 * @returns {Promise<string|null>}
 */
export async function storeGetString(contentId) {
  let { content, isEncrypted } = await store.get(contentId);
  if (!isEncrypted) {
    return content ? utf8Decoder.decode(content) : null;
  }
  // ask for a valid password
  let msg = "";
  while (true) {
    let pwdHash = await getPasswordHashMust(msg);
    let s = null;
    try {
      s = decryptBlobAsString({ key: pwdHash, cipherblob: d });
    } catch (e) {
      console.log(e);
      s = null;
    }
    if (s !== null) {
      return s;
    }
    let pwd = localStorage.getItem(kLSPassowrdKey);
    if (!pwd) {
      msg = "Please enter password to decrypt files";
    } else {
      msg = `Password '${pwd}' is not correct. Please enter valid password.`;
    }
    // password was likely incorrect so remove it so that getPasswordHashMust()
    // asks the user
    removePassword();
  }
  return null;
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

export async function storeDumpIndex() {
  if (!store) {
    console.log("store not initialized");
    return;
  }
  store.dumpIndex();
}
