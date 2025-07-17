const optsCreate = {
  create: true,
};

/**
 * @param {string} path
 * @returns {Promise<number>}
 */
async function ofsGetFileSize2(path) {
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
 * @returns {Promise<number>}
 */
async function ofsGetFileSize(path) {
  const root = await navigator.storage.getDirectory();
  let fh;
  try {
    fh = await root.getFileHandle(path);
  } catch (e) {
    return -1;
  }
  // @ts-ignore
  const accessHandle = await fh.createSyncAccessHandle();
  const size = accessHandle.getSize();
  accessHandle.close();
  return size;
}

/**
 * @param {string} path
 * @param {number} offset
 * @param {number} size
 * @returns {Promise<Uint8Array>}
 */
async function ofsReadFileSegment(path, offset, size) {
  const root = await navigator.storage.getDirectory();
  let fh;
  try {
    fh = await root.getFileHandle(path);
  } catch (e) {
    return null;
  }
  let accessHandle;
  for (let i = 0; i < 3; i++) {
    try {
      // @ts-ignore
      accessHandle = await fh.createSyncAccessHandle();
      break;
    } catch (e) {
      if (i === 2) {
        throw e; // rethrow after 3 attempts
      }
      console.error(
        `Failed to create access handle for ${path}, retrying... (${i + 1})`,
      );
    }
  }
  const ab = new ArrayBuffer(size);
  const buffer = new DataView(ab);
  accessHandle.read(buffer, { at: offset });
  accessHandle.close();
  return new Uint8Array(ab);
}

/**
 * @param {string} path
 * @param {number} offset
 * @param {number} size
 * @returns {Promise<Uint8Array>}
 */
async function ofsReadFileSegment2(path, offset, size) {
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
 * @param {string} path
 * @param {number} offset
 * @param {Uint8Array} blob
 */
async function ofsWriteToFileAtOffset(path, offset, blob) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, optsCreate);
  // @ts-ignore
  const accessHandle = await fh.createSyncAccessHandle();
  accessHandle.write(blob, { at: offset });
  accessHandle.flush();
  accessHandle.close();
}

/**
 * @param {string} path
 * @param {Uint8Array} blob
 * @returns {Promise<number>}
 */
async function ofsAppendToFile(path, blob) {
  // console.log("ofsAppendToFile", path, blob.length);
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, optsCreate);

  // @ts-ignore
  const accessHandle = await fh.createSyncAccessHandle();
  const offset = accessHandle.getSize();
  accessHandle.write(blob, { at: offset });
  accessHandle.flush();
  accessHandle.close();
  return offset;
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function ofsDeleteFile(path) {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(path, { recursive: true });
    return true;
  } catch (e) {
    // it's ok if the file doesn't exist
    return false;
  }
}

let lastMsgs = [];

// Message handler for the web worker
self.onmessage = async function (e) {
  const { id, method, args } = e.data;
  let argsCopy = {};
  for (let k of Object.keys(args)) {
    if (args[k] instanceof ArrayBuffer) {
      continue;
    }
    argsCopy[k] = args[k];
  }
  lastMsgs.push(method, args);
  // keep between 10 and 20 messages
  if (lastMsgs.length > 20 * 2) {
    lastMsgs = lastMsgs.slice(10 * 2);
  }

  try {
    let result;
    // console.log("ofs method:", method, "args:", args);

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
        result = await ofsDeleteFile(args.path);
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    // Send result back to main thread
    self.postMessage(
      {
        req: e.data,
        id,
        success: true,
        result: result,
      },
      result instanceof ArrayBuffer ? [result] : [],
    );
  } catch (error) {
    // Send error back to main thread
    let n = lastMsgs.length / 2;
    for (let i = 0; i < n; i++) {
      console.log(`${lastMsgs[i * 2]}: ${JSON.stringify(lastMsgs[i * 2 + 1])}`);
    }
    console.error("Error in OFS worker:", error, "req:", e.data);
    self.postMessage({
      req: e.data,
      id,
      success: false,
      error: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
};
