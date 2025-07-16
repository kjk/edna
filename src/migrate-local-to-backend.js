import { AppendStore, readFile } from "./appendstore";
import { kMetadataName } from "./metadata";
import { validateLocalStoreIndex } from "./store-local";
import { browserDownloadBlob, formatDateYYYYMMDD, len } from "./util";

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

const localStorageFiles = [kMetadataName];

/**
 * @param {boolean} validate
 * @returns {Promise<Blob|null>}
 */
async function createLocalStoreZip(validate = false) {
  let indexFileName = "notes_store_index.txt";
  let dataFileName = "notes_store_data.bin";
  let indexContent = await readFile(indexFileName);
  if (len(indexContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: index file is empty, skipping migration",
    );
    return null;
  }
  let dataContent = await readFile(dataFileName);
  if (len(dataContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: data file is empty, skipping migration",
    );
    return null;
  }
  if (validate) {
    await validateLocalStoreIndex();
  }

  let libZip = await import("@zip.js/zip.js");
  let blobWriter = new libZip.BlobWriter("application/zip");
  let zipWriter = new libZip.ZipWriter(blobWriter);
  addBinaryBlob(libZip, zipWriter, "index.txt", new Blob([indexContent]));
  addBinaryBlob(libZip, zipWriter, "data.bin", new Blob([dataContent]));
  for (let fileName of localStorageFiles) {
    let s = localStorage.getItem(fileName);
    if (!s) {
      console.warn(
        `createLocalStoreZip: localStorage file ${fileName} not found`,
      );
      continue;
    }
    await addText(libZip, zipWriter, "file:" + fileName, s);
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
  await deleteBrowserStorage(toDelete);
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
