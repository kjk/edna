import { len } from "./util";

/**
 * @param {string} path
 * @returns {Promise<number>}
 */
async function ofsGetFileSize(path) {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle(path);
    const file = await fh.getFile();
    return file.size;
  } catch (e) {
    return -1;
  }
}

/**
 * @param {string} path
 * @param {number} offset
 * @param {number} size
 * @returns {Promise<Uint8Array>}
 */
async function ofsReadFileSegment(path, offset, size) {
  // const startTime = performance.now();
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path);
  const file = await fh.getFile();
  const slice = file.slice(offset, offset + size);
  const data = await slice.arrayBuffer();
  // logDur(startTime, `readFileSegment size:${size}`);
  return new Uint8Array(data);
}

/**
 * @param {string} path
 * @returns {Promise<ArrayBuffer|null>}
 */
export async function ofsReadFile(path) {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle(path);
    const file = await fh.getFile();
    return await file.arrayBuffer();
  } catch (e) {
    console.warn(`file: ${path} error: ${e}`);
    return null;
  }
}

/**
 * @param {string} path
 * @param {number} offset
 * @param {Uint8Array} blob
 */
async function ofsWriteToFileAtOffset(path, offset, blob) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, {
    create: true,
  });
  const writable = await fh.createWritable({
    keepExistingData: true,
  });
  await writable.seek(offset);
  // @ts-ignore
  await writable.write(blob);
  await writable.close();
  return offset;
}

/**
 * @param {string} path
 * @param {Uint8Array} blob
 * @returns {Promise<number>}
 */
async function ofsAppendToFile(path, blob) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, {
    create: true,
  });
  const file = await fh.getFile();
  const offset = file.size;
  const writable = await fh.createWritable({
    keepExistingData: true,
  });
  await writable.seek(offset);
  // @ts-ignore
  await writable.write(blob);
  await writable.close();
  return offset;
}

/**
 * @param {string[]} files
 */
export async function ofsDeleteFiles(files = null) {
  const root = await navigator.storage.getDirectory();
  // @ts-ignore
  for await (const name of root.keys()) {
    if (files && !files.includes(name)) {
      continue;
    }
    await root.removeEntry(name, { recursive: true });
  }
}

/**
 * @param {boolean} recursive
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} dir
 */
export async function ofsListFiles(
  recursive = false,
  dirHandle = null,
  dir = "",
) {
  if (dirHandle == null) {
    dirHandle = await navigator.storage.getDirectory();
    dir = "";
  }
  try {
    // @ts-ignore
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === "file") {
        let f = await handle.getFile();
        console.log(
          `File: ${dir}/${name}, size: ${f.size} bytes, modified: ${f.lastModifiedDate}`,
        );
      } else if (handle.kind === "directory") {
        console.log(`Directory: ${name}`);
        if (recursive) {
          let newDir = dir ? `${dir}/${name}` : name;
          await ofsListFiles(recursive, handle, newDir);
        }
      }
    }
  } catch (error) {
    console.error("ofsListFiles: error:", error);
  }
}

export class FileSystemOFS {
  /**
   * @param {string} path
   * @param {Uint8Array} blob
   * @returns {Promise<number>}
   */
  async appendToFile(path, blob) {
    return await ofsAppendToFile(path, blob);
  }
  /**
   * @param {string} path
   * @param {number} offset
   * @param {Uint8Array} bytes
   */
  async writeToFileAtOffset(path, offset, bytes) {
    await ofsWriteToFileAtOffset(path, offset, bytes);
  }

  /**
   * @param {string} path
   * @returns {Promise<ArrayBuffer|null>}
   */
  async readFile(path) {
    return await ofsReadFile(path);
  }

  /**
   * @param {string} path
   * @returns {Promise<number>}
   */
  async getFileSize(path) {
    return await ofsGetFileSize(path);
  }
  /**
   * @param {string} path
   * @param {number} offset
   * @param {number} size
   * @returns {Promise<Uint8Array>}
   */
  async readFileSegment(path, offset, size) {
    return await ofsReadFileSegment(path, offset, size);
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async deleteFile(path) {
    const root = await navigator.storage.getDirectory();
    try {
      await root.removeEntry(path, { recursive: true });
      return true;
    } catch (e) {
      // it's ok if the file doesn't exist
    }
    return false;
  }
}
