import { throwIf } from "./util";

/**
 * @param {any} fh
 * @param {boolean} withWrite
 * @returns {Promise<boolean>}
 */
export async function requestHandlePermission(fh, withWrite) {
  const opts = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }
  return (await fh.requestPermission(opts)) === "granted";
}

/**
 * @param {any} fh
 * @param {boolean} withWrite
 * @returns {Promise<boolean>}
 */
export async function hasHandlePermission(fh, withWrite) {
  const opts = {};
  if (withWrite) {
    opts.mode = "readwrite";
  }
  let res = await fh.queryPermission(opts);
  return res === "granted";
}

/**
 * @returns {boolean}
 */
export function isIFrame() {
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
  /**
   * @returns {string}
   */
  get name() {
    return this[handleIdx].name;
  }

  /**
   * @returns {boolean}
   */
  get isDir() {
    return this[handleIdx].kind === "directory";
  }

  /**
   * @returns {number}
   */
  get size() {
    return this[sizeIdx];
  }

  /**
   * @param {number} n
   */
  set size(n) {
    throwIf(!this.isDir);
    this[sizeIdx] = n;
  }

  /**
   * @returns {string}
   */
  get path() {
    return this[pathIdx];
  }

  /**
   * @param {string} v
   */
  set path(v) {
    this[pathIdx] = v;
  }

  /**
   * @return any
   */
  get meta() {
    return this[metaIdx];
  }

  set meta(o) {
    this[metaIdx] = o;
  }

  /**
   * @returns {Promise<File>}
   */
  async getFile() {
    throwIf(this.isDir);
    let h = this[handleIdx];
    return await h.getFile();
  }

  /**
   * @param {string} key
   * @retruns {any}
   */
  getMeta(key) {
    let m = this[metaIdx];
    return m ? m[key] : undefined;
  }

  /**
   * @param {string} key
   * @param {any} val
   */
  setMeta(key, val) {
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

  /**
   * @returns {FsEntry[]}
   */
  get dirEntries() {
    throwIf(!this.isDir);
    return this[dirEntriesIdx];
  }

  /**
   * @param {FsEntry[]} v
   */
  set dirEntries(v) {
    throwIf(!this.isDir);
    this[dirEntriesIdx] = v;
  }

  /**
   * @param {any} handle
   * @param {any} parentHandle
   * @param {string} path
   * @returns {Promise<FsEntry>}
   */
  static async fromHandle(handle, parentHandle, path) {
    let size = 0;
    if (handle.kind === "file") {
      let file = await handle.getFile();
      size = file.size;
    }
    return new FsEntry(handle, parentHandle, size, path, [], null);
  }
}

function dontSkip(entry, dir) {
  return false;
}

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {Function} skipEntryFn
 * @param {string} dir
 * @returns {Promise<FsEntry>}
 */
export async function readDirRecur(
  dirHandle,
  skipEntryFn = dontSkip,
  dir = dirHandle.name,
) {
  /** @type {FsEntry[]} */
  let entries = [];
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

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {Function} skipEntryFn
 * @param {string} dir
 * @returns {Promise<FsEntry>}
 */
export async function readDir(
  dirHandle,
  skipEntryFn = dontSkip,
  dir = dirHandle.name,
) {
  /** @type {FsEntry[]} */
  let entries = [];
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

/**
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} dir
 * @returns {Promise<File[]>}
 */
export async function readDirRecurFiles(dirHandle, dir = dirHandle.name) {
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

/**
 *
 * @param {FsEntry} dir
 * @param {Function} fn
 */
export function forEachFsEntry(dir, fn) {
  let entries = dir.dirEntries;
  for (let e of entries) {
    let skip = fn(e);
    if (!skip && e.isDir) {
      forEachFsEntry(e, fn);
    }
  }
  fn(dir);
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
 * @param {boolean} writeAccess
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function openDirPicker(writeAccess) {
  const opts = {
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

/**
 * @returns {boolean}
 */
export function supportsFileSystem() {
  const ok = "showDirectoryPicker" in window && !isIFrame();
  return ok;
}

/**
 * chatgpt says the string is saved in utf-8
 * @param {FileSystemFileHandle} fh
 * @param {string} content
 */
export async function fsFileHandleWriteText(fh, content) {
  const writable = await fh.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 * @param {string} content
 */
export async function fsWriteTextFile(dh, fileName, content) {
  console.log("writing to file:", fileName, content.length);
  let fh = await dh.getFileHandle(fileName, { create: true });
  fsFileHandleWriteText(fh, content);
}

/**
 * @param {FileSystemFileHandle} fh
 * @param {Blob} blob
 */
export async function fsFileHandleWriteBlob(fh, blob) {
  const writable = await fh.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 * @param {Blob} blob
 */
export async function fsWriteBlob(dh, fileName, blob) {
  console.log("writing to file:", fileName, blob.size);
  let fh = await dh.getFileHandle(fileName, { create: true });
  await fsFileHandleWriteBlob(fh, blob);
}

/**
 * @param {FileSystemFileHandle} fh
 * @returns {Promise<string>}
 */
export async function fsFileHandleReadTextFile(fh) {
  const file = await fh.getFile();
  const res = await file.text(); // reads utf-8
  return res;
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 * @returns {Promise<string>}
 */
export async function fsReadTextFile(dh, fileName) {
  // console.log("fsReadTextFile:", fileName);
  let fh = await dh.getFileHandle(fileName, { create: false });
  return await fsFileHandleReadTextFile(fh);
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 * @returns {Promise<Uint8Array>}
 */
export async function fsReadBinaryFile(dh, fileName) {
  // console.log("fsReadBinaryFile:", fileName);
  let fh = await dh.getFileHandle(fileName, { create: false });
  const blob = await fh.getFile();
  const res = await readBlobAsUint8Array(blob);
  return res;
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<void>}
 */
export async function fsRenameFileOld(dh, newName, oldName) {
  let d = await fsReadTextFile(dh, oldName);
  fsWriteTextFile(dh, newName, d);
  fsDeleteFile(dh, oldName);
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<boolean>} true if renamed, false if failed
 */
export async function fsRenameFile(dh, oldName, newName) {
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

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 * @returns {Promise<boolean>} true if exists
 */
export async function fsFileExists(dh, fileName) {
  try {
    await dh.getFileHandle(fileName);
  } catch (e) {
    // getFileHandle() throws exception if file doesn't exist
    console.log(e);
    return false;
  }
  return true;
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} name
 */
export async function fsDeleteFile(dh, name) {
  await dh.removeEntry(name);
}

/**
 * @param {Blob} blob
 * @returns {Promise<Uint8Array>}
 */
async function readBlobAsUint8Array(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (ev) {
      const arrayBuffer = /** @type {ArrayBuffer} */ (ev.target.result);
      const uint8Array = new Uint8Array(arrayBuffer);
      resolve(uint8Array);
    };
    reader.onerror = function (ev) {
      reject(new Error("Failed to read the blob as an ArrayBuffer."));
    };
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * @param {Uint8Array} ua
 * @returns {Blob}
 */
export function blobFromUint8Array(ua) {
  return new Blob([ua]);
}
