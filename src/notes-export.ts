import { appState } from "./appstate.svelte";
import { blobFromUint8Array, fsReadBinaryFile, readDir } from "./fileutil";
import { kMetadataName, loadNotesMetadata } from "./metadata";
import {
  forEachNoteFileFS,
  getStorageFS,
  loadNote,
  loadNoteNames,
  notePathFromNameFS,
} from "./notes";
import { kSettingsPath } from "./settings.svelte";
import { formatDateYYYYMMDD, len, throwIf } from "./util";

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
    // note: note sure if I should export this
    let s = JSON.stringify(appState.settings, null, 2);
    await addTextFile(libZip, zipWriter, kSettingsPath, s);
  }
  let blob = await zipWriter.close();
  return blob;
}

export async function exportRawNotesToZipBlob(): Promise<Blob> {
  console.log("exportRawNotesToZipBlob");
  let dh = getStorageFS();
  throwIf(!dh, "only supported for a file system");
  let libZip = await import("@zip.js/zip.js");
  let blobWriter = new libZip.BlobWriter("application/zip");
  let zipWriter = new libZip.ZipWriter(blobWriter);
  await forEachNoteFileFS(dh, async (fileName, name, isEncr) => {
    let d = await fsReadBinaryFile(dh, fileName);
    let blob = blobFromUint8Array(d);
    await addBinaryBlob(libZip, zipWriter, fileName, blob);
  });
  {
    let meta = await loadNotesMetadata();
    let s = JSON.stringify(meta, null, 2);
    await addTextFile(libZip, zipWriter, kMetadataName, s);
  }
  {
    // note: note sure if I should export this
    let settings = appState.settings;
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

function isBackupFile(fileName: string): boolean {
  if (!fileName.startsWith("edna.backup.")) {
    return false;
  }
  return fileName.endsWith(".zip");
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
