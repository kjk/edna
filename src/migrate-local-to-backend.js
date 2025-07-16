import { addBinaryBlob, addTextFile } from "./ziputil";
import { browserDownloadBlob, formatDateYYYYMMDD, len } from "./util";

import { kMetadataName } from "./metadata";
import { ofsReadFile } from "./appendstore";
import { validateIndex } from "./store-local";

export async function listBrowserStorage() {
  try {
    const root = await navigator.storage.getDirectory();
    console.log("OPFS Root Contents:");

    // @ts-ignore
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === "file") {
        let f = await handle.getFile();
        console.log(
          `File: ${name}, size: ${f.size} bytes, modified: ${f.lastModifiedDate}`,
        );
      } else if (handle.kind === "directory") {
        console.log(`Directory: ${name}`);
      }
    }
  } catch (error) {
    console.error("Error accessing OPFS:", error);
  }
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
  let indexContent = await ofsReadFile(indexFileName);
  if (len(indexContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: index file is empty, skipping migration",
    );
    return null;
  }
  let dataContent = await ofsReadFile(dataFileName);
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
  await deleteBrowserStorage(toDelete);
  await listBrowserStorage();
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
