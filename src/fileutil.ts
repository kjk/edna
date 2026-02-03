import { throwIf } from "./util";

export async function requestHandlePermission(fh: any, withWrite: boolean): Promise<boolean> {
  const opts: any = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }
  return (await fh.requestPermission(opts)) === "granted";
}

export async function hasHandlePermission(fh: any, withWrite: boolean): Promise<boolean> {
  const opts: any = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }
  let res = await fh.queryPermission(opts);
  return res === "granted";
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

  static async fromHandle(handle: any, parentHandle: any, path: string): Promise<FsEntry> {
    let size = 0;
    if (handle.kind === "file") {
      let file = await handle.getFile();
      size = file.size;
    }
    return new FsEntry(handle, parentHandle, size, path, [], null);
  }
}

function dontSkip(entry: any, dir: string): boolean {
  return false;
}

export async function readDirRecur(
  dirHandle: FileSystemDirectoryHandle,
  skipEntryFn = dontSkip,
  dir = dirHandle.name,
): Promise<FsEntry> {
  let entries: FsEntry[] = [];
  // @ts-ignore
  for await (const handle of dirHandle.values()) {
    if (skipEntryFn(handle, dir)) {
      continue;
    }
    const path = dir == "" ? handle.name : `${dir}/${handle.name}`;
    if (handle.kind === "file") {
      let e = await FsEntry.fromHandle(handle, dirHandle, path);
      entries.push(e);
    } else if (handle.kind === "directory") {
      let e = await readDirRecur(handle, skipEntryFn, path);
      e.path = path;
      entries.push(e);
    }
  }
  let res = new FsEntry(dirHandle, null, dir);
  res.dirEntries = entries;
  return res;
}

export async function readDir(
  dirHandle: FileSystemDirectoryHandle,
  skipEntryFn = dontSkip,
  dir = dirHandle.name,
): Promise<FsEntry> {
  let entries: FsEntry[] = [];
  // @ts-ignore
  for await (const handle of dirHandle.values()) {
    if (skipEntryFn(handle, dir)) {
      continue;
    }
    const path = dir == "" ? handle.name : `${dir}/${handle.name}`;
    let e = await FsEntry.fromHandle(handle, dirHandle, path);
    entries.push(e);
  }
  let res = new FsEntry(dirHandle, null, dir);
  res.dirEntries = entries;
  return res;
}

export async function readDirRecurFiles(dirHandle: FileSystemDirectoryHandle, dir = dirHandle.name): Promise<File[]> {
  const dirs = [];
  const files = [];
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
    const path = dir == "" ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === "file") {
      files.push(
        entry.getFile().then((file) => {
          file.directoryHandle = dirHandle;
          file.handle = entry;
          return Object.defineProperty(file, "webkitRelativePath", {
            configurable: true,
            enumerable: true,
            get: () => path,
          });
        }),
      );
    } else if (entry.kind === "directory") {
      dirs.push(readDirRecurFiles(entry, path));
    }
  }
  return [...(await Promise.all(dirs)).flat(), ...(await Promise.all(files))];
}

export function forEachFsEntry(dir: FsEntry, fn: (e: FsEntry) => boolean) {
  let entries = dir.dirEntries;
  for (let e of entries) {
    let skip = fn(e);
    if (!skip && e.isDir) {
      forEachFsEntry(e, fn);
    }
  }
  fn(dir);
}

export async function openDirPicker(writeAccess: boolean): Promise<FileSystemDirectoryHandle | null> {
  const opts: any = {
    mutltiple: false,
  };
  if (writeAccess) {
    opts.mode = "readwrite";
  }
  try {
    // @ts-ignore
    const fh = await window.showDirectoryPicker(opts);
    return fh;
  } catch (e) {
    console.log("openDirPicker: showDirectoryPicker: e:", e);
  }
  return null;
}

export function supportsFileSystem(): boolean {
  const ok = "showDirectoryPicker" in window && !isIFrame();
  return ok;
}

export async function fsFileHandleWriteText(fh: FileSystemFileHandle, content: string) {
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function fsWriteTextFile(dh: FileSystemDirectoryHandle, fileName: string, content: string) {
  console.log("writing to file:", fileName, content.length);
  let fh = await dh.getFileHandle(fileName, { create: true });
  fsFileHandleWriteText(fh, content);
}

export async function fsFileHandleWriteBlob(fh: FileSystemFileHandle, blob: Blob) {
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function fsWriteBlob(dh: FileSystemDirectoryHandle, fileName: string, blob: Blob) {
  console.log("writing to file:", fileName, blob.size);
  let fh = await dh.getFileHandle(fileName, { create: true });
  await fsFileHandleWriteBlob(fh, blob);
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

export async function fsRenameFileOld(dh: FileSystemDirectoryHandle, newName: string, oldName: string): Promise<void> {
  let d = await fsReadTextFile(dh, oldName);
  fsWriteTextFile(dh, newName, d);
  fsDeleteFile(dh, oldName);
}

export async function fsRenameFile(dh: FileSystemDirectoryHandle, oldName: string, newName: string): Promise<boolean> {
  try {
    let f = await dh.getFileHandle(oldName);
    // @ts-ignore
    await f.move(newName);
  } catch (e) {
    // getFileHandle() throws exception if file doesn't exist
    console.log(e);
    return false;
  }
  return true;
}

export async function fsFileExists(dh: FileSystemDirectoryHandle, fileName: string): Promise<boolean> {
  try {
    await dh.getFileHandle(fileName);
  } catch (e) {
    // getFileHandle() throws exception if file doesn't exist
    console.log(e);
    return false;
  }
  return true;
}

export async function fsDeleteFile(dh: FileSystemDirectoryHandle, name: string) {
  await dh.removeEntry(name);
}

async function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (ev) {
      const arrayBuffer = ev.target.result as ArrayBuffer;
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
  return new Blob([ua]);
}
