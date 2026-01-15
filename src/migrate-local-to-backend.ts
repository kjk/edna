import { ofsListFiles } from "./fs-ofs";
import { appFetch } from "./httputil";
import { closeLocalStore, openLocalStore } from "./store";
import {
  createLocalStoreZip,
  deleteLocalStore,
  LocalStore,
  validateIndex,
} from "./store-local";
import { browserDownloadBlob, formatDateYYYYMMDD, len } from "./util";

export async function maybeMigrateNotesLocalToBackend() {
  let localStore = await openLocalStore();
  let recs = localStore.store.records();
  if (len(recs) === 0) {
    closeLocalStore();
    return;
  }
  const blob = await createLocalStoreZip(localStore, true);
  closeLocalStore();
  if (!blob) {
    return;
  }
  try {
    let rsp = await appFetch("/api/store/bulkUpload", {
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
