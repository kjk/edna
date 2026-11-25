import { aiProviders } from "./ai-models";
import { appState } from "./appstate.svelte";
import { kSettingsPath } from "./constants";
import { kMetadataName, serializeNotesMetadata } from "./metadata";
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
  await addTextFile(libZip, zipWriter, kMetadataName, serializeNotesMetadata());
  {
    // don't export API keys: the export is not encrypted and might be shared
    let settings: Record<string, unknown> = { ...appState.settings };
    for (let provider of aiProviders) {
      delete settings[provider.keySetting];
    }
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
