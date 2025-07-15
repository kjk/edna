import { AppendStore } from "./appendstore";

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

export async function deleteBrowserStorage() {
  const root = await navigator.storage.getDirectory();
  // @ts-ignore
  for await (const name of root.keys()) {
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
  }
  await deleteBrowserStorage();
  console.warn("maybeMigrateNotesLocalToBackend: migration completed");
}
