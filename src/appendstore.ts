import { FileSystemMem } from "./fs-mem";
import { FileSystemOFS } from "./fs-ofs";
import { FileSystemWorkerOFS, getFileSystemWorkerOfs } from "./fs-worker-ofs";
import { len, throwIf } from "./util";

export class AppendStoreRecord {
  sizeInFile: number = 0;
  offset: number;
  size: number;
  timestampMs: number;
  kind: string;
  meta: string | null;
  overWritten: boolean;

  constructor(offset: number, size: number, timestampMs: number, kind: string, meta: string | null = null) {
    this.offset = offset;
    this.size = size;
    this.timestampMs = timestampMs;
    this.kind = kind;
    this.meta = meta;
    this.overWritten = false;
  }
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

// if string, encodes as UTF-8
export function toBytes(data: string | Uint8Array | null): Uint8Array | null {
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

function padBytes(bytes: Uint8Array, padSize: number) {
  const paddedBytes = new Uint8Array(bytes.length + padSize);
  paddedBytes.fill(32); // Fill with spaces
  paddedBytes.set(bytes);
  // The rest of the array is already filled with spaces by default
  return paddedBytes;
}

function serializeRecord(rec: AppendStoreRecord): Uint8Array {
  let sz = "";
  if (rec.sizeInFile > 0) {
    sz = `${rec.size}:${rec.sizeInFile}`;
  } else {
    sz = `${rec.size}`;
  }
  let { offset, timestampMs, kind, meta } = rec;
  const line = meta
    ? `${offset} ${sz} ${timestampMs} ${kind} ${meta}\n`
    : `${offset} ${sz} ${timestampMs} ${kind}\n`;
  return utf8Encoder.encode(line);
}

export const kFileSystemOFS = "ofs";
export const kFileSystemMem = "mem";
export const kFileSystemWorkerOFS = "worker-ofs";

export class AppendStore {
  _allRecords: AppendStoreRecord[] = [];
  _nonOverwritten: AppendStoreRecord[] = [];
  indexPath: string;
  dataPath: string;
  fs: FileSystemOFS | FileSystemMem | FileSystemWorkerOFS;

  // when over-writing a record, we expand the data by this much to minimize
  // the amount written to file.
  // 0 means no expansion.
  // 40 means we expand the data by 40%
  // 100 means we expand the data by 100%
  overWriteDataExpandPercent = 100;

  static async create(
    fileNamePrefix = "appendStore",
    fsType = kFileSystemOFS,
    clear = false,
  ): Promise<AppendStore> {
    const indexPath = `${fileNamePrefix}_index.txt`;
    const dataPath = `${fileNamePrefix}_data.bin`;
    let res = new AppendStore(indexPath, dataPath);
    if (fsType === kFileSystemOFS) {
      res.fs = new FileSystemOFS();
    } else if (fsType === kFileSystemMem) {
      res.fs = new FileSystemMem();
    } else if (fsType === kFileSystemWorkerOFS) {
      let fs = await getFileSystemWorkerOfs();
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
      res._calcNonOverwritten();
    }
    return res;
  }

  records() {
    return this._nonOverwritten;
  }

  allRecords() {
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

  constructor(indexPath: string, dataPath: string) {
    this.indexPath = indexPath;
    this.dataPath = dataPath;
  }

  async _writeDataAtOffset(offset: number, data: string | Uint8Array | null, kind: string, meta: string) {
    // high-precision UTC time in milliseconds
    const timestampMs = currTimestampMs();
    let bytes = toBytes(data);
    let size = len(bytes);
    throwIf(size === 0, "Data size must be greater than 0");
    await this.fs.writeToFileAtOffset(this.dataPath, offset, bytes);
    return new AppendStoreRecord(offset, size, timestampMs, kind, meta);
  }

  async _writeBytes(bytes: Uint8Array | null, kind: string, meta: string, additionalBytes: number = 0): Promise<AppendStoreRecord> {
    // high-precision UTC time in milliseconds
    const timestampMs = currTimestampMs();
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

  async _writeRecordToIndex(rec: AppendStoreRecord) {
    const indexBytes = serializeRecord(rec);
    await this.fs.appendToFile(this.indexPath, indexBytes);
    this._allRecords.push(rec);
    this._calcNonOverwritten();
  }

  async appendRecordPreserveTimestamp(rec: AppendStoreRecord, data: string | Uint8Array | null) {
    let { kind, meta } = rec;
    validateKindAndMeta(kind, meta);
    let bytes = toBytes(data);
    let recNew = await this._writeBytes(bytes, kind, meta, 0);
    recNew.timestampMs = rec.timestampMs;
    await this._writeRecordToIndex(recNew);
  }

  async appendRecord(kind: string, meta: string, data: string | Uint8Array | null, additionalBytes: number = 0): Promise<void> {
    validateKindAndMeta(kind, meta);
    let bytes = toBytes(data);
    let rec = await this._writeBytes(bytes, kind, meta, additionalBytes);
    await this._writeRecordToIndex(rec);
  }

  // Potentially overwrites existing record with the same kind and meta.
  // Meant for files for which we don't need to keep history and are frequently
  // written to, like metadata.
  // If we find an existing record with the same kind and meta and
  // enough space for the file, we append new record to index but overwrite
  // the data.
  async overWriteRecord(kind: string, meta: string, data: string | Uint8Array | null): Promise<void> {
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
      let expandPerc = this.overWriteDataExpandPercent;
      let additionalBytes = Math.round((neededSize * expandPerc) / 100);
      await this.appendRecord(kind, meta, bytes, additionalBytes);
      return;
    }

    const timestampMs = currTimestampMs();

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

  async readRecord(rec: AppendStoreRecord): Promise<Uint8Array> {
    const { offset, size } = rec;
    if (offset < 0 || size < 0) {
      throw new Error(`Invalid offset '${offset}' or size '${size}`);
    }

    // if we write empty string, data size is 0
    if (size == 0) {
      return new Uint8Array(0);
    }
    let bytes = await this.fs.readFileSegment(this.dataPath, offset, size);
    return bytes;
  }

  // Reads a record from the store as a string
  async readRecordAsString(rec: AppendStoreRecord): Promise<string | null> {
    let bytes = await this.readRecord(rec);
    return bytes ? utf8Decoder.decode(bytes) : null;
  }

  async _readIndex(): Promise<AppendStoreRecord[]> {
    const d = await this.fs.readFile(this.indexPath);
    if (!d) {
      return [];
    }
    const text = utf8Decoder.decode(d);
    return parseIndex(text);
  }

  // for debugging
  async getIndexContent(): Promise<ArrayBuffer | null> {
    return await this.fs.readFile(this.indexPath);
  }

  // for debugging
  async getDataContent(): Promise<ArrayBuffer | null> {
    return await this.fs.readFile(this.dataPath);
  }

  // for debugging
  async getIndexAsString(): Promise<string> {
    const d = await this.getIndexContent();
    return d ? utf8Decoder.decode(d) : "";
  }
}

export function parseIndexCb(s: string, callback: (line: string, record: AppendStoreRecord) => void) {
  const lines = s.split("\n");
  let n = lines.length;
  console.warn(`parseIndexCb: ${n} lines`);
  if (n > 0 && lines[n - 1] === "") {
    n--; // remove the last empty line
  }
  let rest, line;
  for (let i = 0; i < n; i++) {
    line = lines[i];
    // console.warn(`i: ${i}, line: '${line}'`);
    if (line === "") {
      console.error(`s: ${s}`);
      continue;
    }
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

function parseIndex(s: string): AppendStoreRecord[] {
  const records = [];
  parseIndexCb(s, (line, record) => {
    records.push(record);
  });
  return records;
}

function validateKindAndMeta(kind: string, meta: string) {
  if (!kind || kind.includes(" ") || kind.includes("\n")) {
    throw new Error(
      "Kind must be a non-empty string without spaces or newlines",
    );
  }
  if (meta && meta.includes("\n")) {
    throw new Error("Meta cannot contain newline characters");
  }
}

export function currTimestampMs() {
  // new Date().valueOf()
  return Math.round(performance.timeOrigin + performance.now());
}
