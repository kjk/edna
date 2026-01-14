import { len } from "./util";

async function ofsGetFileSize(path: string): Promise<number> {
  const root = await navigator.storage.getDirectory();
  try {
    const fh = await root.getFileHandle(path);
    const file = await fh.getFile();
    return file.size;
  } catch (e) {
    return -1;
  }
}

async function ofsReadFileSegment(path: string, offset: number, size: number): Promise<Uint8Array> {
  // const startTime = performance.now();
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path);
  const file = await fh.getFile();
  const slice = file.slice(offset, offset + size);
  const data = await slice.arrayBuffer();
  // logDur(startTime, `readFileSegment size:${size}`);
  return new Uint8Array(data);
}

export async function ofsReadFile(path: string): Promise<ArrayBuffer | null> {
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

async function ofsWriteToFileAtOffset(path: string, offset: number, blob: Uint8Array) {
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

async function ofsAppendToFile(path: string, blob: Uint8Array): Promise<number> {
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

export async function ofsDeleteFiles(files: string[] = null) {
  const root = await navigator.storage.getDirectory();
  // @ts-ignore
  for await (const name of root.keys()) {
    if (files && !files.includes(name)) {
      continue;
    }
    await root.removeEntry(name, { recursive: true });
  }
}

export async function ofsListFiles(
  recursive: boolean = false,
  dirHandle: FileSystemDirectoryHandle = null,
  dir: string = "",
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
  async appendToFile(path: string, blob: Uint8Array): Promise<number> {
    return await ofsAppendToFile(path, blob);
  }
  async writeToFileAtOffset(path: string, offset: number, bytes: Uint8Array) {
    await ofsWriteToFileAtOffset(path, offset, bytes);
  }

  async readFile(path: string): Promise<ArrayBuffer | null> {
    return await ofsReadFile(path);
  }

  async getFileSize(path: string): Promise<number> {
    return await ofsGetFileSize(path);
  }
  async readFileSegment(path: string, offset: number, size: number): Promise<Uint8Array> {
    return await ofsReadFileSegment(path, offset, size);
  }

  async deleteFile(path: string): Promise<boolean> {
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
