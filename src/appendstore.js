import { len, logDur, throwIf } from "./util";

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

let utf8Encoder = new TextEncoder();
/**
 * if string, encodes as UTF-8
 * @param {string|Uint8Array} data
 * @returns {Uint8Array|null}
 */
function toBytes(data) {
  if (!data) {
    return null;
  }
  if (typeof data === "string") {
    return utf8Encoder.encode(data);
  } else if (data instanceof Uint8Array) {
    return data;
  }
  throw new Error("Invalid data type: must be string or Uint8Array");
}

function padBytes(bytes, padSize) {
  const paddedBytes = new Uint8Array(bytes.length + padSize);
  paddedBytes.fill(32); // Fill with spaces
  paddedBytes.set(bytes);
  // The rest of the array is already filled with spaces by default
  return paddedBytes;
}

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
 *
 * @param {string} path
 * @param {Uint8Array} blob
 * @retruns {number}
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

  async getIndexAsString() {
    const d = await ofsReadFile(this.indexPath);
    return d ? this.utf8Decoder.decode(d) : "";
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
  async _writeDataAtOffset(offset, data, kind, meta) {
    // high-precision UTC time in milliseconds
    const timestampMs = Math.round(performance.timeOrigin + performance.now());
    let bytes = toBytes(data);
    let size = len(bytes);
    throwIf(size === 0, "Data size must be greater than 0");
    await ofsWriteToFileAtOffset(this.dataPath, offset, bytes);
    return new AppendStoreRecord(offset, size, timestampMs, kind, meta);
  }

  /**
   * @param {string|Uint8Array|null} data
   */
  async _writeData(data, kind, meta, padSize = 0) {
    // high-precision UTC time in milliseconds
    const timestampMs = Math.round(performance.timeOrigin + performance.now());
    let bytes = toBytes(data);
    let size = len(bytes);
    if (size === 0) {
      // it's ok for data to be empty
      return new AppendStoreRecord(0, 0, timestampMs, kind, meta);
    }
    if (padSize > 0) {
      bytes = padBytes(bytes, padSize);
    }
    let offset = await ofsAppendToFile(this.dataPath, bytes);
    return new AppendStoreRecord(offset, size, timestampMs, kind, meta);
  }

  /**
   * Potentially overwrites existing record with the same kind and meta.
   * Meant for files for which we don't need to keep history and are frequently
   * written to, like metadata.
   * If we find an existing record with the same kind and meta and
   * enough space for the file, we append new record to index but overwrite
   * the data.
   * @param {string|Uint8Array|null} data
   * @param {string} kind
   * @param {string} meta
   * @param {number} reserveSpaceFactor : 1.4 or 2 are good values
   */
  async overWriteRecord(data, kind, meta, reserveSpaceFactor = 1.0) {
    const startTime = performance.now();
    validateKindAndMeta(kind, meta);
    let existingRecordsIndexes = [];
    let recs = this.records;
    let n = recs.length;
    for (let i = 0; i < n; i++) {
      let rec = recs[i];
      if (rec.kind === kind && rec.meta === meta) {
        existingRecordsIndexes.push(i);
      }
    }
    if (len(existingRecordsIndexes) === 0) {
      let padSize = 0;
      if (reserveSpaceFactor > 1.0) {
        padSize = Math.ceil(data.length * (reserveSpaceFactor - 1.0));
      }
      await this.appendRecord(data, kind, meta, padSize);
      return;
    }

    let dataSize = -1;
    async function calcRecordSize(idx) {
      // size of the record idx is the difference between its offset
      // and the offset of the next non-empty record
      let rec = recs[idx];
      for (let i = idx + 1; idx < n; i++) {
        let rec2 = recs[i];
        if (rec2.offset === 0) {
          continue;
        }
        let size = rec2.offset - rec.offset;
        return size;
      }
      if (dataSize < 0) {
        dataSize = await ofsGetFileSize(this.dataPath);
      }
      return dataSize - rec.offset;
    }
    for (let idx of existingRecordsIndexes) {
      let size = await calcRecordSize.call(this, idx);
      if (size >= data.length) {
        // we have enough space to overwrite the record
        let rec = await this._writeData(data, kind, meta);
        recs[idx] = rec; // overwrite the record
        logDur(startTime, `AppendStore.overWriteRecord`);
        return;
      }
    }

    // existing records don't have enough space, so we append a new record
    // TODO: pas reserveSpaceFactor to
    await this.appendRecord(data, kind, meta);
  }

  /**
   * @param {string|Uint8Array|null} data
   * @param {string} kind
   * @param {string} meta
   * @param {number} padSize
   */
  async appendRecord(data, kind, meta = null, padSize = 0) {
    const startTime = performance.now();
    validateKindAndMeta(kind, meta);
    let rec = await this._writeData(data, kind, meta);
    let { offset, size, timeInMs } = rec;

    const line = meta
      ? `${offset} ${size} ${timeInMs} ${kind} ${meta}\n`
      : `${offset} ${size} ${timeInMs} ${kind}\n`;
    console.warn("line:", line);
    const indexBytes = this.utf8Encoder.encode(line);
    await ofsAppendToFile(this.indexPath, indexBytes);
    this.records.push(rec);
    logDur(startTime, `AppendStore.appendRecord`);
  }

  async readString(offset, size) {
    if (offset < 0 || size < 0) {
      throw new Error(`Invalid offset '${offset}' or size '${size}`);
    }

    // if we write empty string, data size is 0
    if (size == 0) {
      return "";
    }
    let bytes = await ofsReadFileSegment(this.dataPath, offset, size);
    return this.utf8Decoder.decode(bytes);
  }

  /**
   * @returns {Promise<AppendStoreRecord[]>}
   */
  async _readIndex() {
    const d = await ofsReadFile(this.indexPath);
    if (!d) {
      return [];
    }
    const text = this.utf8Decoder.decode(d);
    return parseIndex(text);
  }
}

/**
 * @param {string} s
 * @param {(line: string, record: AppendStoreRecord) => void} callback
 */
export function parseIndexCb(s, callback) {
  const lines = s.split("\n");
  let n = lines.length;
  if (n > 0 && lines[n - 1] === "") {
    n--; // remove the last empty line
  }
  let rest, line;
  for (let i = 0; i < n; i++) {
    line = lines[i];
    rest = line;
    const offsetEnd = rest.indexOf(" ");
    throwIf(offsetEnd === -1, `Invalid index line: '${line}'`);
    const offset = parseInt(rest.slice(0, offsetEnd), 10);
    throwIf(isNaN(offset), `Invalid offset in index line: '${line}'`);

    rest = rest.slice(offsetEnd + 1);
    const sizeEnd = rest.indexOf(" ");
    throwIf(isNaN(sizeEnd), `Invalid index line: '${line}'`);
    const size = parseInt(rest.slice(0, sizeEnd), 10);

    rest = rest.slice(sizeEnd + 1);
    const timeEnd = rest.indexOf(" ");
    throwIf(isNaN(timeEnd), `Invalid index line: '${line}'`);
    const time = parseFloat(rest.slice(0, timeEnd));
    throwIf(isNaN(time), `Invalid time in index line: '${line}'`);
    throwIf(time < 10000, `Invalid time < 10000 in index line: '${line}'`);

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
    const record = new AppendStoreRecord(offset, size, time, kind, meta);
    callback(line, record);
  }
}

/**
 * @param {string} s
 * @returns {AppendStoreRecord[]}
 */
function parseIndex(s) {
  const records = [];
  parseIndexCb(s, (line, record) => {
    records.push(record);
  });
  return records;
}

function validateKindAndMeta(kind, meta) {
  if (!kind || kind.includes(" ") || kind.includes("\n")) {
    throw new Error(
      "Kind must be a non-empty string without spaces or newlines",
    );
  }
  if (meta && meta.includes("\n")) {
    throw new Error("Meta cannot contain newline characters");
  }
}

export async function dumpIndex() {
  const path = "notes_store_index.txt";
  const d = await ofsReadFile(path);
  if (!d) {
    console.log("no index file exists");
    return;
  }
  const s = new TextDecoder().decode(d);
  console.log("index:", s);
}
