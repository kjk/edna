import { ofsListFiles } from "./fs-ofs";
import { elarisFetch } from "./httputil";
import { closeLocalStore, openLocalStore } from "./store";
import { deleteLocalStore, LocalStore, validateIndex } from "./store-local";
import { browserDownloadBlob, formatDateYYYYMMDD, len } from "./util";
import { addBinaryBlob } from "./ziputil";

/**
 * @param {LocalStore} localStore
 * @param {boolean} validate
 * @returns {Promise<Blob | null>}
 */
export async function createLocalStoreZip(localStore, validate = false) {
  let indexContent = await localStore.store.getIndexContent();
  if (len(indexContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: index file is empty, skipping migration",
    );
    return null;
  }
  let dataContent = await localStore.store.getDataContent();
  if (len(dataContent) === 0) {
    console.warn(
      "maybeMigrateNotesLocalToBackend: data file is empty, skipping migration",
    );
    return null;
  }
  closeLocalStore();

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
  let blob = await zipWriter.close();
  return blob;
}

export async function maybeMigrateNotesLocalToBackend() {
  let localStore = await openLocalStore();
  let recs = localStore.store.records();
  if (len(recs) === 0) {
    return;
  }
  const blob = await createLocalStoreZip(localStore, true);
  if (!blob) {
    return;
  }
  try {
    let rsp = await elarisFetch("/api/store/bulkUpload", {
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
      "maybeMigrateNotesLocalToBackend: error uploading append store zip:",
      e,
    );
  }
  await deleteLocalStore();
  await ofsListFiles();
  console.warn("maybeMigrateNotesLocalToBackend: migration completed");
}

export async function downloadBrowserStoreAsZip() {
  console.log("downloadBrowserStoreAsZip");
  let localStore = await openLocalStore();
  const blob = await createLocalStoreZip(localStore, true);
  if (!blob) {
    return;
  }
  let name = "notes_store" + formatDateYYYYMMDD() + ".zip";
  browserDownloadBlob(blob, name);
}
