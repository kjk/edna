import { logDur } from "./util";

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
  const startTime = performance.now();
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path);
  const file = await fh.getFile();
  const slice = file.slice(offset, offset + size);
  const data = await slice.arrayBuffer();
  logDur(startTime, `readFileSegment size:${size}`);
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
 *
 * @param {FileSystemFileHandle} fh
 * @param {number} offset
 * @param {Uint8Array} bytes
 */
async function ofsWriteAtOffset(fh, offset, bytes) {
  const writable = await fh.createWritable({
    keepExistingData: true,
  });
  await writable.seek(offset);
  await writable.write(bytes);
  await writable.close();
}

/**
 * @param {string} path
 * @param {number} offset
 * @param {Uint8Array} bytes
 */
async function ofsWriteToFileAtOffset(path, offset, bytes) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, {
    create: true,
  });
  await ofsWriteAtOffset(fh, offset, bytes);
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
  await ofsWriteAtOffset(fh, offset, blob);
  return offset;
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
}
