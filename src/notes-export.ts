import { appState } from "./appstate.svelte";
import { kSettingsPath } from "./constants";
import { kMetadataName, loadNotesMetadata } from "./metadata";
import { loadNote, loadNoteNames, notePathFromNameFS } from "./notes";
import { formatDateYYYYMMDD } from "./util";

async function addBinaryBlob(libZip: any, zipWriter: any, fileName: string, fileBlob: Blob) {
  let blobReader = new libZip.BlobReader(fileBlob);
  let opts = {
    level: 9,
  };
  await zipWriter.add(fileName, blobReader, opts);
}

async function addTextFile(libZip: any, zipWriter: any, fileName: string, text: string) {
  let fileBlob = new Blob([text], { type: "text/plain" });
  await addBinaryBlob(libZip, zipWriter, fileName, fileBlob);
}

export async function exportUnencryptedNotesToZipBlob(): Promise<Blob> {
  console.log("exportUnencryptedNotesToZipBlob");
  let libZip = await import("@zip.js/zip.js");
  let blobWriter = new libZip.BlobWriter("application/zip");
  let zipWriter = new libZip.ZipWriter(blobWriter);
  let noteNames = await loadNoteNames();
  for (let name of noteNames) {
    let s = await loadNote(name);
    if (!s) continue;
    // always use un-encrypted file extension
    let fileName = notePathFromNameFS(name, false);
    await addTextFile(libZip, zipWriter, fileName, s);
  }
  {
    let meta = await loadNotesMetadata();
    let s = JSON.stringify(meta, null, 2);
    await addTextFile(libZip, zipWriter, kMetadataName, s);
  }
  {
    // don't export API keys: the export is not encrypted and might be shared
    let { openAIKey, xAIKey, openRouterKey, ...settings } = appState.settings;
    let s = JSON.stringify(settings, null, 2);
    await addTextFile(libZip, zipWriter, kSettingsPath, s);
  }
  let blob = await zipWriter.close();
  return blob;
}

export async function exportNotesToZip() {
  let blob = await exportUnencryptedNotesToZipBlob();
  let name = "edna.notes.export-" + formatDateYYYYMMDD() + ".zip";
  browserDownloadBlob(blob, name);
}

export function browserDownloadBlob(blob: Blob, name: string) {
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
