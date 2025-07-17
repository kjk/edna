import { addBinaryBlob, addTextFile } from "./ziputil";
import { browserDownloadBlob, formatDateYYYYMMDD, len } from "./util";

import { kMetadataName } from "./metadata";
import { localStore } from "./store";
import { ofsListFiles } from "./fs-ofs";
import { validateIndex } from "./store-local";

const localStorageFiles = [kMetadataName];

/**
 * @param {boolean} validate
 * @returns {Promise<Blob|null>}
 */
async function createLocalStoreZip(validate = false) {
  let store = localStore?.store;
  if (!store) {
    console.warn("createLocalStoreZip: localStore is not initialized");
    return null;
  }
  let indexContent = await store.getIndexContent();
  if (len(indexContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: index file is empty, skipping migration",
    );
    return null;
  }
  let dataContent = await store.getDataContent();
  if (len(dataContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: data file is empty, skipping migration",
    );
    return null;
  }
  if (validate) {
    let s = new TextDecoder().decode(indexContent);
    try {
      validateIndex(s);
    } catch (e) {
      console.log(s);
      throw e;
    }
  }

  let libZip = await import("@zip.js/zip.js");
  let blobWriter = new libZip.BlobWriter("application/zip");
  let zipWriter = new libZip.ZipWriter(blobWriter);
  await addBinaryBlob(libZip, zipWriter, "index.txt", new Blob([indexContent]));
  await addBinaryBlob(libZip, zipWriter, "data.bin", new Blob([dataContent]));
  for (let fileName of localStorageFiles) {
    let s = localStorage.getItem(fileName);
    if (!s) {
      console.warn(
        `createLocalStoreZip: localStorage file ${fileName} not found`,
      );
      continue;
    }
    await addTextFile(libZip, zipWriter, "file:" + fileName, s);
  }
  let blob = await zipWriter.close();
  return blob;
}

export async function maybeMigrateNotesLocalToBackend() {
  const blob = await createLocalStoreZip(true);
  if (!blob) {
    return;
  }
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
  }
  let toDelete = ["notes_store_data.bin", "notes_store_index.txt"];
  await ofsDeleteFiles(toDelete);
  await ofsListFiles();
  for (let file of localStorageFiles) {
    localStorage.removeItem(file);
  }
  console.warn("maybeMigrateNotesLocalToBackend: migration completed");
}

export async function downloadBrowserStoreAsZip() {
  console.log("downloadBrowserStoreAsZip");
  const blob = await createLocalStoreZip(true);
  if (!blob) {
    return;
  }
  let name = "notes_store" + formatDateYYYYMMDD() + ".zip";
  browserDownloadBlob(blob, name);
}
