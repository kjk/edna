import { logDur } from "./util";

export class AppendStoreRecord {
  constructor(offset, size, timeInMs, kind, meta = "") {
    /** @type {number} */
    this.offset = offset;
    /** @type {number} */
    this.size = size;
    /** @type {number} */
    this.timeInMs = timeInMs;
    /** @type {string} */
    this.kind = kind;
    /** @type {string?} */
    this.meta = meta;
  }
}

/**
 *
 * @param {string} path
 * @param {number} offset
 * @param {number} size
 * @returns {Promise<Uint8Array>}
 */
async function readFileSegment(path, offset, size) {
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
 *
 * @param {string} path
 * @returns
 */
async function readFile(path) {
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
async function writeAtOffset(fh, offset, bytes) {
  const writable = await fh.createWritable({
    keepExistingData: true,
  });
  await writable.seek(offset);
  await writable.write(bytes);
  await writable.close();
}

/**
 *
 * @param {string} path
 * @param {Uint8Array} blob
 * @retruns {number}
 */
async function appendToFile(path, blob) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(path, {
    create: true,
  });
  const file = await fh.getFile();
  const offset = file.size;
  await writeAtOffset(fh, offset, blob);
  return offset;
}

export class AppendStore {
  /** @type {AppendStoreRecord[]} */
  records = [];
  /** @type {string} */
  indexPath;
  /** @type {string} */
  dataPath;

  static async create(fileNamePrefix = "appendStore") {
    const indexPath = `${fileNamePrefix}_index.txt`;
    const dataPath = `${fileNamePrefix}_data.bin`;
    let res = new AppendStore(indexPath, dataPath);
    res.records = await res._readIndex();
    return res;
  }

  /**
   *
   * @param {string} indexPath
   * @param {string} dataPath
   */
  constructor(indexPath, dataPath) {
    this.indexPath = indexPath;
    this.dataPath = dataPath;
    this.utf8Encoder = new TextEncoder();
    this.utf8Decoder = new TextDecoder();
  }

  /**
   * @param {string|Uint8Array|null} data
   */
  async _writeData(data, kind, meta) {
    // high-precision UTC time in milliseconds
    const timestampMs = Math.round(performance.timeOrigin + performance.now());
    if (!data) {
      // it's ok for data to be empty
      return new AppendStoreRecord(0, 0, timestampMs, kind, meta);
    }
    /** @type {Uint8Array} */
    let bytes;
    let size = 0;
    if (data) {
      if (typeof data === "string") {
        bytes = this.utf8Encoder.encode(data);
      } else if (data instanceof Uint8Array) {
        bytes = data;
      } else {
        throw new Error("Invalid data type: must be string or Uint8Array");
      }
      size = bytes.length;
    }
    if (size === 0) {
      // it's ok for data to be empty
      return new AppendStoreRecord(0, 0, timestampMs, kind, meta);
    }
    let offset = await appendToFile(this.dataPath, bytes);
    return new AppendStoreRecord(offset, size, timestampMs, kind, meta);
  }

  /**
   * @param {string|Uint8Array|null} data
   * @param {string} kind
   * @param {string} meta
   */
  async appendRecord(data, kind, meta = null) {
    const startTime = performance.now();
    if (!kind || kind.includes(" ") || kind.includes("\n")) {
      throw new Error(
        "Kind must be a non-empty string without spaces or newlines",
      );
    }
    if (meta && meta.includes("\n")) {
      throw new Error("Meta data cannot contain newline characters");
    }
    let rec = await this._writeData(data, kind, meta);
    let { offset, size, timeInMs } = rec;

    const line = meta
      ? `${offset} ${size} ${timeInMs} ${kind} ${meta}\n`
      : `${offset} ${size} ${timeInMs} ${kind}\n`;
    console.warn("line:", line);
    const indexBytes = this.utf8Encoder.encode(line);
    await appendToFile(this.indexPath, indexBytes);
    this.records.push(rec);
    logDur(startTime, `AppendStore.write`);
  }

  async readString(offset, size) {
    if (offset < 0 || size < 0) {
      throw new Error(`Invalid offset '${offset}' or size '${size}`);
    }

    // if we write empty string, data size is 0
    if (size == 0) {
      return "";
    }
    let bytes = await readFileSegment(this.dataPath, offset, size);
    return this.utf8Decoder.decode(bytes);
  }

  /**
   * @returns {Promise<AppendStoreRecord[]>}
   */
  async _readIndex() {
    const d = await readFile(this.indexPath);
    if (!d) {
      return [];
    }
    const text = this.utf8Decoder.decode(d);
    return parseIndex(text);
  }
}

/**
 * @param {string} s
 * @returns {AppendStoreRecord[]}
 */
function parseIndex(s) {
  const lines = s.split("\n").filter((line) => line.trim() !== "");

  const records = [];
  for (let line of lines) {
    let rest = line.trim();
    const offsetEnd = rest.indexOf(" ");
    if (offsetEnd === -1) continue;
    const offset = parseInt(rest.slice(0, offsetEnd), 10);

    rest = rest.slice(offsetEnd + 1);
    const sizeEnd = rest.indexOf(" ");
    if (sizeEnd === -1) continue;
    const size = parseInt(rest.slice(0, sizeEnd), 10);

    rest = rest.slice(sizeEnd + 1);
    const timeEnd = rest.indexOf(" ");
    if (timeEnd === -1) continue;
    const time = parseFloat(rest.slice(0, timeEnd));

    rest = rest.slice(timeEnd + 1);
    const kindEnd = rest.indexOf(" ");
    let kind, meta;
    if (kindEnd === -1) {
      kind = rest;
      meta = null;
    } else {
      kind = rest.slice(0, kindEnd);
      meta = rest.slice(kindEnd + 1);
    }
    if (isNaN(offset) || isNaN(size) || isNaN(time)) {
      continue;
    }
    records.push(new AppendStoreRecord(offset, size, time, kind, meta));
  }
  return records;
}

export async function dumpIndex() {
  const path = "notes_store_index.txt";
  const d = await readFile(path);
  if (!d) {
    console.log("no index file exists");
    return;
  }
  const s = new TextDecoder().decode(d);
  console.log("index:", s);
}
