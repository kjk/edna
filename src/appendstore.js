import { FileSystemMem } from "./fs-mem";
import { FileSystemOFS } from "./fs-ofs";
import { FileSystemWorkerOFS } from "./fs-worker-ofs";
import { len, logDur, throwIf } from "./util";

export class AppendStoreRecord {
  /** @type {number} */
  sizeInFile = 0;
  /**
   * @param {number} offset
   * @param {number} size
   * @param {number} timeInMs
   * @param {string} kind
   * @param {string} meta
   */
  constructor(offset, size, timeInMs, kind, meta = null) {
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
    this.overWritten = false;
  }
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

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

/**
 * @param {Uint8Array} bytes
 * @param {number} padSize
 */
function padBytes(bytes, padSize) {
  const paddedBytes = new Uint8Array(bytes.length + padSize);
  paddedBytes.fill(32); // Fill with spaces
  paddedBytes.set(bytes);
  // The rest of the array is already filled with spaces by default
  return paddedBytes;
}

/**
 * @param {AppendStoreRecord} rec
 * @returns {Uint8Array}
 */
function serializeRecord(rec) {
  let sz = "";
  if (rec.sizeInFile > 0) {
    sz = `${rec.size}:${rec.sizeInFile}`;
  } else {
    sz = `${rec.size}`;
  }
  let { offset, timeInMs, kind, meta } = rec;
  const line = meta
    ? `${offset} ${sz} ${timeInMs} ${kind} ${meta}\n`
    : `${offset} ${sz} ${timeInMs} ${kind}\n`;
  return utf8Encoder.encode(line);
}

export const kFileSystemOFS = "ofs";
export const kFileSystemMem = "mem";
export const kFileSystemWorkerOFS = "worker-ofs";

export class AppendStore {
  /** @type {AppendStoreRecord[]} */
  _allRecords = [];
  /** @type {AppendStoreRecord[]} */
  _nonOverwritten = [];
  /** @type {string} */
  indexPath;
  /** @type {string} */
  dataPath;
  /** @type {FileSystemOFS | FileSystemMem | FileSystemWorkerOFS} */
  fs;

  // when over-writing a record, we expand the data by this much to minimize
  // the amount written to file.
  // 0 means no expansion.
  // 40 means we expand the data by 40%
  // 100 means we expand the data by 100%
  overWriteDataExpandPercent = 140;

  /**
   * @param {string} fileNamePrefix
   * @param {string} fsType
   * @param {boolean} clear
   * @returns {Promise<AppendStore>}
   */
  static async create(
    fileNamePrefix = "appendStore",
    fsType = kFileSystemOFS,
    clear = false,
  ) {
    const indexPath = `${fileNamePrefix}_index.txt`;
    const dataPath = `${fileNamePrefix}_data.bin`;
    let res = new AppendStore(indexPath, dataPath);
    if (fsType === kFileSystemOFS) {
      res.fs = new FileSystemOFS();
    } else if (fsType === kFileSystemMem) {
      res.fs = new FileSystemMem();
    } else if (fsType === kFileSystemWorkerOFS) {
      let fs = new FileSystemWorkerOFS();
      await fs.initWorker();
      res.fs = fs;
    } else {
      throw new Error(
        `Unknown file system type: ${fsType} (must be 'ofs' or 'mem')`,
      );
    }
    if (clear) {
      await res.fs.deleteFile(indexPath);
      await res.fs.deleteFile(dataPath);
    } else {
      res._allRecords = await res._readIndex();
    }
    return res;
  }

  records() {
    return this._allRecords;
  }

  _calcNonOverwritten() {
    let recs = this._allRecords;
    let n = len(recs);
    let res = new Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
      let r = recs[i];
      if (r.overWritten) {
        continue;
      }
      res[j++] = r;
    }
    res.length = j;
    this._nonOverwritten = res;
  }

  /**
   * @param {string} indexPath
   * @param {string} dataPath
   */
  constructor(indexPath, dataPath) {
    this.indexPath = indexPath;
    this.dataPath = dataPath;
  }

  /**
   * @param {string | Uint8Array | null} data
   * @param {number} offset
   * @param {string} kind
   * @param {string} meta
   */
  async _writeDataAtOffset(offset, data, kind, meta) {
    // high-precision UTC time in milliseconds
    const timestampMs = Math.round(performance.timeOrigin + performance.now());
    let bytes = toBytes(data);
    let size = len(bytes);
    throwIf(size === 0, "Data size must be greater than 0");
    await this.fs.writeToFileAtOffset(this.dataPath, offset, bytes);
    return new AppendStoreRecord(offset, size, timestampMs, kind, meta);
  }

  /**
   * @param {Uint8Array | null} bytes
   * @param {string} kind
   * @param {string} meta
   * @param {number} additionalBytes
   * @returns {Promise<AppendStoreRecord>}
   */
  async _writeBytes(bytes, kind, meta, additionalBytes = 0) {
    // high-precision UTC time in milliseconds
    const timestampMs = Math.round(performance.timeOrigin + performance.now());
    let size = len(bytes);
    if (size === 0) {
      // it's ok for data to be empty
      return new AppendStoreRecord(0, 0, timestampMs, kind, meta);
    }
    if (additionalBytes > 0) {
      bytes = padBytes(bytes, additionalBytes);
    }
    let offset = await this.fs.appendToFile(this.dataPath, bytes);
    let rec = new AppendStoreRecord(offset, size, timestampMs, kind, meta);
    if (additionalBytes > 0) {
      rec.sizeInFile = size + additionalBytes;
    }
    return rec;
  }

  /**
   * @param {AppendStoreRecord} rec
   */
  async _writeRecordToIndex(rec) {
    const indexBytes = serializeRecord(rec);
    await this.fs.appendToFile(this.indexPath, indexBytes);
    this._allRecords.push(rec);
    this._calcNonOverwritten();
  }

  /**
   * @param {string} kind
   * @param {string|Uint8Array|null} data
   * @param {string} meta
   * @param {number} additionalBytes
   * @return {Promise<void>}
   */
  async appendRecord(kind, data, meta = null, additionalBytes = 0) {
    validateKindAndMeta(kind, meta);
    let bytes = toBytes(data);
    let rec = await this._writeBytes(bytes, kind, meta, additionalBytes);
    await this._writeRecordToIndex(rec);
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
   * @return {Promise<void>}
   */
  async overWriteRecord(data, kind, meta) {
    // const startTime = performance.now();
    validateKindAndMeta(kind, meta);

    let bytes = toBytes(data);
    // find a record that we can overwrite
    let recToOverwriteIdx = -1;
    let recs = this._allRecords;
    let neededSize = len(bytes);
    for (let i = 0; i < len(recs); i++) {
      let rec = recs[i];
      if (
        rec.kind === kind &&
        rec.meta === meta &&
        rec.sizeInFile >= neededSize
      ) {
        recToOverwriteIdx = i;
      }
      break;
    }

    if (recToOverwriteIdx == -1) {
      // no record to overwrite, append a new one with potentially padding
      // for future overwrites
      let op = this.overWriteDataExpandPercent;
      let additionalBytes = (neededSize * op) / 100;
      await this.appendRecord(kind, bytes, meta, additionalBytes);
      return;
    }

    const timestampMs = Math.round(performance.timeOrigin + performance.now());

    let recOverwritten = this._allRecords[recToOverwriteIdx];
    let offset = recOverwritten.offset;
    recOverwritten.overWritten = true;
    await this.fs.writeToFileAtOffset(this.dataPath, offset, bytes);
    let rec = new AppendStoreRecord(
      offset,
      bytes.length,
      timestampMs,
      kind,
      meta,
    );
    await this._writeRecordToIndex(rec);
  }

  /**
   * Reads a record from the store as a string
   * @param {AppendStoreRecord} rec
   * @returns {Promise<string>}
   */
  async readRecordAsString(rec) {
    const { offset, size } = rec;
    if (offset < 0 || size < 0) {
      throw new Error(`Invalid offset '${offset}' or size '${size}`);
    }

    // if we write empty string, data size is 0
    if (size == 0) {
      return "";
    }
    let bytes = await this.fs.readFileSegment(this.dataPath, offset, size);
    return utf8Decoder.decode(bytes);
  }

  /**
   * @returns {Promise<AppendStoreRecord[]>}
   */
  async _readIndex() {
    const d = await this.fs.readFile(this.indexPath);
    if (!d) {
      return [];
    }
    const text = utf8Decoder.decode(d);
    return parseIndex(text);
  }

  /**
   * for debugging
   * @returns {Promise<ArrayBuffer|null>}
   */
  async getIndexContent() {
    return await this.fs.readFile(this.indexPath);
  }

  /**
   * for debugging
   * @returns {Promise<ArrayBuffer|null>}
   */
  async getDataContent() {
    return await this.fs.readFile(this.dataPath);
  }

  /**
   * for debugging
   * @returns {Promise<string>}
   */
  async getIndexAsString() {
    const d = await this.fs.readFile(this.indexPath);
    return d ? utf8Decoder.decode(d) : "";
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
    let szStr = rest.slice(0, sizeEnd);
    let szParts = szStr.split(":");
    const size = parseInt(szParts[0], 10);
    let sizeInFile = len(szParts) == 2 ? parseInt(szParts[1], 10) : 0;

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
  // TODO: now that store can have a different file system,
  // needs store instance
  // const path = "notes_store_index.txt";
  // const d = await ofsReadFile(path);
  // if (!d) {
  //   console.log("no index file exists");
  //   return;
  // }
  // const s = new TextDecoder().decode(d);
  // console.log("index:", s);
}
