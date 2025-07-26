import {
  decryptBlob,
  decryptBlobAsString,
  encryptBlob,
  encryptStringAsBlob,
} from "kiss-crypto";
import { AppendStore, kFileSystemOFS } from "./appendstore";
import { modalInfoState } from "./components/ModalInfo.svelte";
import {
  getPasswordHash,
  getPasswordHashMust,
  kLSPassowrdKey,
  removePassword,
} from "./encrypt";
import { getFileSystemWorkerOfs } from "./fs-worker-ofs";
import { elarisFetch } from "./httputil";
import { Note } from "./note";
import { BackendStore, createBackendStore } from "./store-backend";
import {
  createLocalStore,
  kLocalStorePrefix,
  kStoreCreateNote,
  kStoreDeleteNote,
  kStorePut,
  kStorePutEncrypted,
  kStoreSetNoteMeta,
  kStoreWriteFile,
  LocalStore,
  parseCreateNoteMeta,
  parsePutMeta,
} from "./store-local";
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
  await store.put(verId, d, true);
}

/**
 * TODO: test returning null and handle that in the UI
 * @param {string} contentId
 * @returns {Promise<string|null>}
 */
export async function storeGetString(contentId) {
  let res = await store.get(contentId);
  if (!res) {
    console.error(`storeGetString: no content for id ${contentId}`);
    return null;
  }
  let { content, isEncrypted } = res;
  if (!isEncrypted) {
    return content ? utf8Decoder.decode(content) : null;
  }
  let d = await decryptBlobInteractive(content);
  let s = utf8Decoder.decode(d);
  return s;
}

/** @type { LocalStore } */
export let localStore;

/**
 * @returns {Promise<LocalStore>}
 */
export async function openLocalStore() {
  throwIf(!!store, "store already opened");
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
  throwIf(!!store, "store already opened");
  backendStore = await createBackendStore();
  store = backendStore;
  await store.flushOfflineChanges();
  return backendStore;
}

export async function storeDumpIndex() {
  if (!store) {
    console.log("store not initialized");
    return;
  }
  store.dumpIndex();
}

/**
 * @param {Uint8Array} blob
 * @returns {Promise<Uint8Array>}
 */
async function decryptBlobInteractive(blob) {
  let msg = "";
  while (true) {
    let pwdHash = await getPasswordHashMust(msg);
    let decryptedBlob = null;
    try {
      decryptedBlob = decryptBlob({ key: pwdHash, cipherblob: blob });
    } catch (e) {
      console.log(e);
      decryptedBlob = null;
    }
    if (decryptedBlob !== null) {
      return decryptedBlob;
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
}

const kDecryptedPrefix = "decrypted_store";
/**
 * @returns {Promise<number>}
 */
export async function localStoreDecryptAllNotes() {
  let currStore = localStore.store;
  let recs = currStore.records();
  let decryptedStore = await AppendStore.create(
    kDecryptedPrefix,
    kFileSystemOFS,
    true,
  );
  let nDecrypted = 0;

  /** @type {Map<string, Note>} */
  let idToNote = new Map();
  let data;
  // TODO: could skip deleted notes
  for (let rec of recs) {
    switch (rec.kind) {
      case kStoreCreateNote:
        {
          let [id, name] = parseCreateNoteMeta(rec.meta);
          idToNote.set(id, new Note(id, name));
        }
        break;
      case kStoreDeleteNote:
        {
          let id = rec.meta;
          let n = idToNote.get(id);
          n.isDeleted = true;
        }
        break;
      case kStoreSetNoteMeta:
        {
          let m = JSON.parse(rec.meta);
          let n = idToNote.get(m.id);
          n.name = m.name;
        }
        break;
    }
    switch (rec.kind) {
      case kStoreCreateNote:
      case kStoreDeleteNote:
      case kStoreSetNoteMeta:
        await decryptedStore.appendRecordPreserveTimestamp(rec, null);
        break;
      case kStoreWriteFile:
      case kStorePut:
        data = await currStore.readRecord(rec);
        await decryptedStore.appendRecordPreserveTimestamp(rec, data);
        break;
      case kStorePutEncrypted:
        let [id, _] = parsePutMeta(rec.meta);
        let name = idToNote.get(id).name;
        data = await currStore.readRecord(rec);
        let decryptedBlob = await decryptBlobInteractive(data);
        rec.kind = kStorePut;
        await decryptedStore.appendRecordPreserveTimestamp(rec, decryptedBlob);
        nDecrypted++;
        modalInfoState.addMessage(`Decrypted note ${name} version ${rec.meta}`);
        break;
      default:
        throw new Error(`unknown record kind: ${rec.kind}`);
    }
  }

  let fs = await getFileSystemWorkerOfs();
  await fs.renameFile(
    kDecryptedPrefix + "_index.txt",
    kLocalStorePrefix + "_index.txt",
  );
  await fs.renameFile(
    kDecryptedPrefix + "_data.bin",
    kLocalStorePrefix + "_data.bin",
  );
  closeLocalStore();
  await openLocalStore();
  return nDecrypted;
}

const kEncryptedPrefix = "encrypted_store";
/**
 * @param {string} pwdHash
 * @returns {Promise<number>}
 */
export async function localStoreEncryptAllNotes(pwdHash) {
  let currStore = localStore.store;
  let recs = currStore.records();
  let encryptedStore = await AppendStore.create(
    kEncryptedPrefix,
    kFileSystemOFS,
    true,
  );
  let nEncrypted = 0;

  /** @type {Map<string, Note>} */
  let idToNote = new Map();
  let data;
  // TODO: could skip deleted notes
  for (let rec of recs) {
    switch (rec.kind) {
      case kStoreCreateNote:
        {
          let [id, name] = parseCreateNoteMeta(rec.meta);
          idToNote.set(id, new Note(id, name));
        }
        break;
      case kStoreDeleteNote:
        {
          let id = rec.meta;
          let n = idToNote.get(id);
          n.isDeleted = true;
        }
        break;
      case kStoreSetNoteMeta:
        {
          let m = JSON.parse(rec.meta);
          let n = idToNote.get(m.id);
          n.name = m.name;
        }
        break;
    }
    switch (rec.kind) {
      case kStoreCreateNote:
      case kStoreDeleteNote:
      case kStoreSetNoteMeta:
        await encryptedStore.appendRecordPreserveTimestamp(rec, null);
        break;
      case kStorePutEncrypted:
      case kStoreWriteFile:
        data = await currStore.readRecord(rec);
        await encryptedStore.appendRecordPreserveTimestamp(rec, data);
        break;
      case kStorePut:
        let [id, _] = parsePutMeta(rec.meta);
        let name = idToNote.get(id).name;
        data = await currStore.readRecord(rec);
        let dataEncrypted = encryptBlob({ key: pwdHash, plainblob: data });
        rec.kind = kStorePutEncrypted;
        await encryptedStore.appendRecordPreserveTimestamp(rec, dataEncrypted);
        nEncrypted++;
        modalInfoState.addMessage(`Encrypted note ${name} version ${rec.meta}`);
        break;
      default:
        throw new Error(`unknown record kind: ${rec.kind}`);
    }
  }
  let fs = await getFileSystemWorkerOfs();
  await fs.renameFile(
    kEncryptedPrefix + "_index.txt",
    kLocalStorePrefix + "_index.txt",
  );
  await fs.renameFile(
    kEncryptedPrefix + "_data.bin",
    kLocalStorePrefix + "_data.bin",
  );
  closeLocalStore();
  await openLocalStore();
  return nEncrypted;
}

/**
 * @param {string} pwdHash
 * @returns {Promise<number>}
 */
export async function backendStoreEncryptAllNotes(pwdHash) {
  let rsp = await elarisFetch("/api/store/getVersionsToEncrypt");
  if (!rsp.ok) {
    console.error(
      "backendStoreEncryptAllNotes: failed to get versions to encrypt",
    );
    modalInfoState.addMessage("Failed to get versions to encrypt");
    modalInfoState.canClose = true;
    return 0;
  }
  modalInfoState.addMessage("Got notes to encrypt, starting encryption");
  let blob = await rsp.blob();
  let libZip = await import("@zip.js/zip.js");
  let blobReader = new libZip.BlobReader(blob);
  let zipReader = new libZip.ZipReader(blobReader);

  let zipWriter = new libZip.ZipWriter(new libZip.BlobWriter());

  let entries = await zipReader.getEntries();
  let nEntries = entries.length;
  for (let e of entries) {
    let name = e.filename;
    modalInfoState.addMessage(`Encrypting <b>${name}</b>`);
    let data = await e.getData(new libZip.BlobWriter());
    let dataUint8 = new Uint8Array(await data.arrayBuffer());
    let dataEncrypted = encryptBlob({ key: pwdHash, plainblob: dataUint8 });
    let dataEncryptedBlob = new Blob([dataEncrypted]);
    await zipWriter.add(name, new libZip.BlobReader(dataEncryptedBlob));
  }
  let body = await zipWriter.close();

  modalInfoState.addMessage("Uploading encrypted versions");
  rsp = await elarisFetch("/api/store/uploadEncrypted", {
    method: "POST",
    body: body,
  });
  if (!rsp.ok) {
    console.error(
      "backendStoreEncryptAllNotes: failed to upload encrypted notes",
    );
    modalInfoState.addMessage("Failed to upload encrypted notes");
    return 0;
  }
  // TODO: reload info about notes?
  return nEntries;
}

/**
 * @returns {Promise<number>}
 */
export async function backendStoreDecryptAllNotes() {
  let rsp = await elarisFetch("/api/store/getVersionsToDecrypt");
  if (!rsp.ok) {
    console.error(
      "backendStoreDecryptAllNotes: failed to get versions to decrypt",
    );
    modalInfoState.addMessage("Failed to get versions to decrypt");
    modalInfoState.canClose = true;
    return 0;
  }
  modalInfoState.addMessage("Got notes to decrypt, starting decryption");
  let blob = await rsp.blob();
  let libZip = await import("@zip.js/zip.js");
  let blobReader = new libZip.BlobReader(blob);
  let zipReader = new libZip.ZipReader(blobReader);

  let zipWriter = new libZip.ZipWriter(new libZip.BlobWriter());

  let entries = await zipReader.getEntries();
  let nEntries = entries.length;
  for (let e of entries) {
    let name = e.filename;
    modalInfoState.addMessage(`Encrypting <b>${name}</b>`);
    let data = await e.getData(new libZip.BlobWriter());
    let dataUint8 = new Uint8Array(await data.arrayBuffer());
    let dataDecrypted = await decryptBlobInteractive(dataUint8);
    let dataDecryptedBlob = new Blob([dataDecrypted]);
    await zipWriter.add(name, new libZip.BlobReader(dataDecryptedBlob));
  }
  let body = await zipWriter.close();

  modalInfoState.addMessage("Uploading decrypted versions");
  rsp = await elarisFetch("/api/store/uploadDecrypted", {
    method: "POST",
    body: body,
  });
  if (!rsp.ok) {
    console.error(
      "backendStoreDecryptAllNotes: failed to upload decrypted notes",
    );
    modalInfoState.addMessage("Failed to upload decrypted notes");
    return 0;
  }
  modalInfoState.addMessage(
    `Finished decrypting ${nEntries} versions of notes`,
  );
  // TODO: reload info about notes?
  return nEntries;
}

/**
 * @param {string} pwdHash
 * @returns {Promise<number>}
 */
export async function storeEncryptAllNotes(pwdHash) {
  if (!store) {
    console.error("store not initialized");
    return;
  }
  if (store === localStore) {
    return await localStoreEncryptAllNotes(pwdHash);
  }

  if (store === backendStore) {
    return await backendStoreEncryptAllNotes(pwdHash);
  }

  console.error("neither local nor backend store");
}

/**
 * @returns {Promise<number>}
 */
export async function storeDecryptAllNotes() {
  if (!store) {
    console.error("store not initialized");
    return;
  }
  if (store === localStore) {
    return await localStoreDecryptAllNotes();
  }

  if (store === backendStore) {
    return await backendStoreDecryptAllNotes();
  }

  console.error("neither local nor backend store");
}
