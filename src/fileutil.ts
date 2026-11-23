import { throwIf, valueOrUndefined } from "./util";

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

// a directory tree. each element is either a file:
// [file,      dirHandle, name, path, size, null]
// or directory:
// [[entries], dirHandle, name, path, size, null]
// extra null value is for the caller to stick additional data
// without the need to re-allocate the array
// if you need more than 1, use an object

// handle (file or dir), parentHandle (dir), size, path, dirEntries, meta
const handleIdx = 0;
const parentHandleIdx = 1;
const sizeIdx = 2;
const pathIdx = 3;
const dirEntriesIdx = 4;
const metaIdx = 5;

export class FsEntry extends Array {
  constructor(
    handle?: FileSystemHandle,
    parentHandle?: FileSystemDirectoryHandle | null,
    size?: number,
    path?: string,
    dirEntries?: FsEntry[],
    meta?: any,
  ) {
    super();
    if (handle !== undefined) {
      this[handleIdx] = handle;
      this[parentHandleIdx] = parentHandle;
      this[sizeIdx] = size;
      this[pathIdx] = path;
      this[dirEntriesIdx] = dirEntries;
      this[metaIdx] = meta;
    }
  }

  get name(): string {
    return this[handleIdx].name;
  }

  get isDir(): boolean {
    return this[handleIdx].kind === "directory";
  }

  get size(): number {
    return this[sizeIdx];
  }

  set size(n: number) {
    throwIf(!this.isDir);
    this[sizeIdx] = n;
  }

  get path(): string {
    return this[pathIdx];
  }

  set path(v: string) {
    this[pathIdx] = v;
  }

  get meta(): any {
    return this[metaIdx];
  }

  set meta(o: any) {
    this[metaIdx] = o;
  }

  async getFile(): Promise<File> {
    throwIf(this.isDir);
    let h = this[handleIdx];
    return await h.getFile();
  }

  getMeta(key: string): any {
    let m = this[metaIdx];
    return m ? m[key] : undefined;
  }

  setMeta(key: string, val: any) {
    let m = this[metaIdx] || {};
    m[key] = val;
    this[metaIdx] = m;
  }

  get handle() {
    return this[handleIdx];
  }

  get parentDirHandle() {
    return this[parentHandleIdx];
  }

  get dirEntries(): FsEntry[] {
    throwIf(!this.isDir);
    return this[dirEntriesIdx];
  }

  set dirEntries(v: FsEntry[]) {
    throwIf(!this.isDir);
    this[dirEntriesIdx] = v;
  }

  // getting the size requires reading file metadata, which is slow for many files
  static async fromHandle(handle: any, parentHandle: any, path: string, withSize = true): Promise<FsEntry> {
    let size = 0;
    if (withSize && handle.kind === "file") {
      let file = await handle.getFile();
      size = file.size;
    }
    return new FsEntry(handle, parentHandle, size, path, [], null);
  }
}

function dontSkip(entry: any, dir: string): boolean {
  return false;
}

// note: size of file entries is only set if withSizes is true
export async function readDir(
  dirHandle: FileSystemDirectoryHandle,
  skipEntryFn = dontSkip,
  dir = dirHandle.name,
  withSizes = false,
): Promise<FsEntry> {
  let entries: FsEntry[] = [];
  // @ts-ignore
  for await (const handle of dirHandle.values()) {
    if (skipEntryFn(handle, dir)) {
      continue;
    }
    const path = dir == "" ? handle.name : `${dir}/${handle.name}`;
    let e = await FsEntry.fromHandle(handle, dirHandle, path, withSizes);
    entries.push(e);
  }
  let res = new FsEntry(dirHandle, null, 0, dir, [], null);
  res.dirEntries = entries;
  return res;
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
