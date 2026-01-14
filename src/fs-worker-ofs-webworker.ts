const optsCreate = {
  create: true,
};

async function ofsGetFileSize2(path: string): Promise<number> {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle(path);
    const file = await fh.getFile();
    return file.size;
  } catch (e) {
    return -1;
  }
}

async function ofsGetFileSize(path: string): Promise<number> {
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

async function ofsReadFileSegment(path: string, offset: number, size: number): Promise<Uint8Array> {
  const root = await navigator.storage.getDirectory();
  let fh;
  try {
    fh = await root.getFileHandle(path);
  } catch (e) {
    return null;
  }
  // @ts-ignore
  let accessHandle = await fh.createSyncAccessHandle();
  const ab = new ArrayBuffer(size);
  const buffer = new DataView(ab);
  accessHandle.read(buffer, { at: offset });
  accessHandle.close();
  return new Uint8Array(ab);
}

async function ofsReadFile(path: string): Promise<ArrayBuffer | null> {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle(path);
    const file = await fh.getFile();
    return await file.arrayBuffer();
  } catch (e) {
    return null;
  }
}

async function ofsWriteToFileAtOffset(path: string, offset: number, blob: Uint8Array) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, optsCreate);
  // @ts-ignore
  const accessHandle = await fh.createSyncAccessHandle();
  accessHandle.write(blob, { at: offset });
  accessHandle.flush();
  accessHandle.close();
}

async function ofsWriteFile(path: string, blob: Uint8Array) {
  await ofsDeleteFile(path);
  await ofsWriteToFileAtOffset(path, 0, blob);
}

async function ofsAppendToFile(path: string, blob: Uint8Array): Promise<number> {
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

async function ofsDeleteFile(path: string): Promise<boolean> {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(path, { recursive: true });
    return true;
  } catch (e) {
    // it's ok if the file doesn't exist
    return false;
  }
}

async function ofsRenameFile(oldPath: any, newPath: any) {
  let d = await ofsReadFile(oldPath);
  let u8 = new Uint8Array(d);
  await ofsWriteFile(newPath, u8);
  await ofsDeleteFile(oldPath);
}

let lastMsgs = [];

// Message handler for the web worker
self.onmessage = async function (e) {
  const { id, method, args } = e.data;
  // don't retain large objects
  let argsCopy = {};
  for (let k of Object.keys(args)) {
    if (k === "blob") {
      continue;
    }
    if (args[k] instanceof ArrayBuffer) {
      continue;
    }
    if (args[k] instanceof Uint8Array) {
      continue;
    }
    argsCopy[k] = args[k];
  }
  lastMsgs.push(method, argsCopy);
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

      case "renameFile":
        result = await ofsRenameFile(args.oldPath, args.newPath);
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
      let k = lastMsgs[i * 2];
      let v = lastMsgs[i * 2 + 1];
      console.log(`${k}: `, v);
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
