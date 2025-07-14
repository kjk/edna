import { AppendStore } from "./appendstore";
import { Note } from "./note";
import { BackendStore } from "./store-backend";
import { LocalStore, notesFromStoreLog } from "./store-local";
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
