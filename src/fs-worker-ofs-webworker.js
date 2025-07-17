// Web Worker for FileSystemWorkerOFS
// This worker handles all OPFS operations in a separate thread

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
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path);
  const file = await fh.getFile();
  const slice = file.slice(offset, offset + size);
  const data = await slice.arrayBuffer();
  return new Uint8Array(data);
}

/**
 * @param {string} path
 * @returns {Promise<ArrayBuffer|null>}
 */
async function ofsReadFile(path) {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle(path);
    const file = await fh.getFile();
    return await file.arrayBuffer();
  } catch (e) {
    return null;
  }
}

/**
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

/**
 * @param {string} path
 */
async function ofsDeleteFile(path) {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(path, { recursive: true });
}

// Message handler for the web worker
self.onmessage = async function (e) {
  const { id, method, args } = e.data;

  try {
    let result;

    switch (method) {
      case "appendToFile":
        result = await ofsAppendToFile(args.path, new Uint8Array(args.blob));
        break;

      case "writeToFileAtOffset":
        await ofsWriteToFileAtOffset(
          args.path,
          args.offset,
          new Uint8Array(args.bytes),
        );
        result = undefined;
        break;

      case "readFile":
        result = await ofsReadFile(args.path);
        break;

      case "getFileSize":
        result = await ofsGetFileSize(args.path);
        break;

      case "readFileSegment":
        result = await ofsReadFileSegment(args.path, args.offset, args.size);
        break;

      case "deleteFile":
        await ofsDeleteFile(args.path);
        result = undefined;
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    // Send result back to main thread
    self.postMessage(
      {
        id,
        success: true,
        result: result,
      },
      result instanceof ArrayBuffer ? [result] : [],
    );
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      id,
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
};
