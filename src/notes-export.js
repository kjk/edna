import { browserDownloadBlob, formatDateYYYYMMDD } from "./util";
import { kMetadataName, loadAppMetadata } from "./metadata";

import { addTextFile } from "./ziputil";
import { appState } from "./appstate.svelte";
import { kSettingsPath } from "./settings.svelte";
import { loadNoteContent } from "./notes";

/**
 * packs all notes, un-encrypted, into a .zip blob
 * @returns {Promise<Blob>}
 */
export async function exportUnencryptedNotesToZipBlob() {
  console.log("exportUnencryptedNotesToZipBlob");
  let libZip = await import("@zip.js/zip.js");
  let blobWriter = new libZip.BlobWriter("application/zip");
  let zipWriter = new libZip.ZipWriter(blobWriter);
  for (let note of appState.regularNotes) {
    let s = await loadNoteContent(note.name);
    // always use un-encrypted file extension
    // let fileName = notePathFromNameFS(name, false);
    // await addTextFile(libZip, zipWriter, fileName, s);
  }
  {
    let meta = await loadAppMetadata();
    let s = JSON.stringify(meta, null, 2);
    await addTextFile(libZip, zipWriter, kMetadataName, s);
  }
  {
    // note: note sure if I should export this
    let s = JSON.stringify(appState.settings, null, 2);
    await addTextFile(libZip, zipWriter, kSettingsPath, s);
  }
  let blob = await zipWriter.close();
  return blob;
}

export async function exportNotesToZip() {
  let blob = await exportUnencryptedNotesToZipBlob();
  let name = "elaris.notes.export-" + formatDateYYYYMMDD() + ".zip";
  browserDownloadBlob(blob, name);
}
