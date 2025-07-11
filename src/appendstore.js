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

export class AppendStore {
  static async create(fileNamePrefix = "appendStore") {
    const indexFileName = `${fileNamePrefix}_index.txt`;
    const dataFileName = `${fileNamePrefix}_data.bin`;
    const root = await navigator.storage.getDirectory();
    const indexHandle = await root.getFileHandle(indexFileName, {
      create: true,
    });
    const dataHandle = await root.getFileHandle(dataFileName, { create: true });
    let res = new AppendStore(indexHandle, dataHandle);
    res.records = await res._readIndex();
  }

  constructor(indexHandle, dataHandle) {
    this.indexHandle = indexHandle;
    this.dataHandle = dataHandle;
    this.utf8Encoder = new TextEncoder();
    this.records = [];
  }

  /**
   * @param {string|Uint8Array|null} data
   */
  async _writeData(data, kind, meta) {
    // Get high-precision UTC time in milliseconds
    const timeInMs = Math.round(performance.timeOrigin + performance.now());
    // Get current offset (size of data file)
    const dataFile = await this.dataHandle.getFile();
    const offset = dataFile.size;
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
    let rec = new AppendStoreRecord(offset, size, timeInMs, kind, meta);
    if (size === 0) {
      // it's ok for data to be empty
      return rec;
    }
    // Append to data file
    const dataWritable = await this.dataHandle.createWritable({
      keepExistingData: true,
    });
    await dataWritable.seek(offset);
    await dataWritable.write(bytes);
    await dataWritable.close();
    return rec;
  }

  /**
   * @param {string|Uint8Array|null} data
   * @param {string} kind
   * @param {string} meta
   */
  async write(data, kind, meta = null) {
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

    // Create index line
    const line =
      meta !== null && meta !== undefined
        ? `${offset} ${size} ${timeInMs} ${kind} ${meta}\n`
        : `${offset} ${size} ${timeInMs} ${kind}\n`;
    const indexBytes = this.utf8Encoder.encode(line);

    // Append to index file
    const indexFile = await this.indexHandle.getFile();
    const indexOffset = indexFile.size;
    const indexWritable = await this.indexHandle.createWritable({
      keepExistingData: true,
    });
    await indexWritable.seek(indexOffset);
    await indexWritable.write(indexBytes);
    await indexWritable.close();

    this.records.push(rec);
    logDur(startTime, `AppendStore.write`);
  }

  async _readIndex() {
    const file = await this.indexHandle.getFile();
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const lines = text.split("\n").filter((line) => line.trim() !== "");

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
}
