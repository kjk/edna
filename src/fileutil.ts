import { valueOrUndefined } from "./util";

function permissionOpts(withWrite: boolean): any {
  return withWrite ? { mode: "readwrite" } : {};
}

export async function requestHandlePermission(fh: any, withWrite: boolean): Promise<boolean> {
  return (await fh.requestPermission(permissionOpts(withWrite))) === "granted";
}

// asks the user for write permission to a file or directory; errors count as denied
export async function requestWritePermission(fh: FileSystemHandle | undefined): Promise<boolean> {
  try {
    return await requestHandlePermission(fh, true);
  } catch (e) {
    console.log("requestWritePermission:", e);
    return false;
  }
}

export async function hasHandlePermission(fh: any, withWrite: boolean): Promise<boolean> {
  return (await fh.queryPermission(permissionOpts(withWrite))) === "granted";
}

export function isIFrame(): boolean {
  let isIFrame = false;
  try {
    // in iframe, those are different
    isIFrame = window.self !== window.top;
  } catch {
    // do nothing
  }
  return isIFrame;
}

export async function openDirPicker(writeAccess: boolean): Promise<FileSystemDirectoryHandle | null> {
  const opts: any = {
    mutltiple: false,
    ...permissionOpts(writeAccess),
  };
  // fails if the user cancels
  // @ts-ignore
  let dh: FileSystemDirectoryHandle | undefined = await valueOrUndefined(window.showDirectoryPicker(opts), "openDirPicker:");
  return dh ?? null;
}

export function supportsFileSystem(): boolean {
  const ok = "showDirectoryPicker" in window && !isIFrame();
  return ok;
}

// Brave supports the File System Access API but disables it by default (#80)
export function isBraveWithoutFileSystem(): boolean {
  return "brave" in navigator && !("showDirectoryPicker" in window) && !isIFrame();
}

export const kBraveEnableFileSystemMsg =
  "Brave disables storing notes in a directory by default. To enable it, open brave://flags/#file-system-access-api, set it to Enabled and restart Brave.";

export async function fsFileHandleWrite(fh: FileSystemFileHandle, data: string | Blob) {
  const writable = await fh.createWritable();
  await writable.write(data);
  await writable.close();
}

export async function fsWriteFile(dh: FileSystemDirectoryHandle, fileName: string, data: string | Blob) {
  console.log("writing to file:", fileName, typeof data === "string" ? data.length : data.size);
  let fh = await dh.getFileHandle(fileName, { create: true });
  await fsFileHandleWrite(fh, data);
}

export async function fsFileHandleReadTextFile(fh: FileSystemFileHandle): Promise<string> {
  const file = await fh.getFile();
  const res = await file.text(); // reads utf-8
  return res;
}

export async function fsReadTextFile(dh: FileSystemDirectoryHandle, fileName: string): Promise<string> {
  // console.log("fsReadTextFile:", fileName);
  let fh = await dh.getFileHandle(fileName, { create: false });
  return await fsFileHandleReadTextFile(fh);
}

export async function fsReadBinaryFile(dh: FileSystemDirectoryHandle, fileName: string): Promise<Uint8Array> {
  // console.log("fsReadBinaryFile:", fileName);
  let fh = await dh.getFileHandle(fileName, { create: false });
  const blob = await fh.getFile();
  const res = await readBlobAsUint8Array(blob);
  return res;
}

export async function fsDeleteFile(dh: FileSystemDirectoryHandle, name: string) {
  await dh.removeEntry(name);
}

async function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (ev) {
      const arrayBuffer = ev.target!.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      resolve(uint8Array);
    };
    reader.onerror = function (ev) {
      reject(new Error("Failed to read the blob as an ArrayBuffer."));
    };
    reader.readAsArrayBuffer(blob);
  });
}

export function blobFromUint8Array(ua: Uint8Array): Blob {
  return new Blob([ua as BlobPart]);
}
