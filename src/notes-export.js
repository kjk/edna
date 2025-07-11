import { appState } from "./appstate.svelte";
import { blobFromUint8Array, fsReadBinaryFile, readDir } from "./fileutil";
import { kMetadataName, loadAppMetadata } from "./metadata";
import { loadNote } from "./notes";
import { kSettingsPath } from "./settings.svelte";
import { formatDateYYYYMMDD, len, throwIf } from "./util";

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
 * @param {string} text
 */
async function addTextFile(libZip, zipWriter, fileName, text) {
  let fileBlob = new Blob([text], { type: "text/plain" });
  await addBinaryBlob(libZip, zipWriter, fileName, fileBlob);
}

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
    let s = await loadNote(note.name);
    // always use un-encrypted file extension
    debugger;
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
  let name = "edna.notes.export-" + formatDateYYYYMMDD() + ".zip";
  browserDownloadBlob(blob, name);
}

/**
 * @param {string} fileName
 * @returns {boolean}
 */
function isBackupFile(fileName) {
  if (!fileName.startsWith("edna.backup.")) {
    return false;
  }
  return fileName.endsWith(".zip");
}

const kMaxBackupFiles = 14;
/**
 * @param {FileSystemDirectoryHandle} dhBackup
 */
async function deleteOldBackups(dhBackup) {
  let fsEntries = await readDir(dhBackup);
  // console.log("files", fsEntries);

  let backupFiles = [];
  for (let e of fsEntries.dirEntries) {
    if (e.isDir) {
      continue;
    }
    if (!isBackupFile(e.name)) {
      continue;
    }
    backupFiles.push(e.name);
  }
  let nFiles = len(backupFiles);
  if (nFiles <= kMaxBackupFiles) {
    console.log(
      `not deleting old backups because ${nFiles} backup files is less than ${kMaxBackupFiles}`,
    );
    return;
  }
  backupFiles.sort();
  for (let i = kMaxBackupFiles; i < nFiles; i++) {
    let fileName = backupFiles[i];
    await dhBackup.removeEntry(fileName);
    console.log(`deleted ${fileName} backup file`);
  }
}

/**
 * @param {Blob} blob
 * @param {string} name
 */
export function browserDownloadBlob(blob, name) {
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
