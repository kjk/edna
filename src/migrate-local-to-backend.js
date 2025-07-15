import { AppendStore } from "./appendstore";
import { kMetadataName } from "./metadata";
import { browserDownloadBlob, formatDateYYYYMMDD } from "./util";

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

/**
 * @param {any} libZip
 * @param {any} zipWriter
 * @param {string} fileName
 * @param {string} s
 */
async function addText(libZip, zipWriter, fileName, s) {
  let utf8 = new TextEncoder().encode(s);
  return await addBinaryBlob(libZip, zipWriter, fileName, new Blob([utf8]));
}

/**
 *
 * @param {string} indexFileName
 * @param {string} dataFileName
 * @param {string[]} localStorageFiles
 * @returns {Promise<Blob>}
 */
export async function getAppendStoreZip(
  indexFileName,
  dataFileName,
  localStorageFiles,
) {
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
  for (let fileName of localStorageFiles) {
    let s = localStorage.getItem(fileName);
    if (!s) {
      console.warn(
        `getAppendStoreZip: localStorage file ${fileName} not found`,
      );
      continue;
    }
    await addText(libZip, zipWriter, "file:" + fileName, s);
  }
  let blob = await zipWriter.close();
  return blob;
}

export async function deleteBrowserStorage(files = null) {
  const root = await navigator.storage.getDirectory();
  // @ts-ignore
  for await (const name of root.keys()) {
    if (files && !files.includes(name)) {
      continue;
    }
    await root.removeEntry(name, { recursive: true });
    console.warn(`Deleted entry: ${name}`);
  }
  console.warn("Browser storage cleared.");
}

export async function maybeMigrateNotesLocalToBackend() {
  let indexFileName = "notes_store_index.txt";
  let dataFileName = "notes_store_data.bin";
  let store = await AppendStore.create("notes_store");
  if (store.records.length === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: no records in store, skipping upload to backend",
    );
    return;
  }
  let localStorageFiles = [kMetadataName];
  let blob = await getAppendStoreZip(
    indexFileName,
    dataFileName,
    localStorageFiles,
  );
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
  await deleteBrowserStorage(toDelete);
  for (let file of localStorageFiles) {
    localStorage.removeItem(file);
  }
  console.warn("maybeMigrateNotesLocalToBackend: migration completed");
}

export async function downloadBrowserStoreAsZip() {
  console.log("downloadBrowserStoreAsZip");
  let indexFileName = "notes_store_index.txt";
  let dataFileName = "notes_store_data.bin";
  let files = [kMetadataName];
  let blob = await getAppendStoreZip(indexFileName, dataFileName, files);
  let name = "notes_store" + formatDateYYYYMMDD() + ".zip";
  browserDownloadBlob(blob, name);
}
