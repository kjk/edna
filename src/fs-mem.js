import { logDur } from "./util";

export class FileSystemMem {
  constructor() {
    /** @type {Map<string, Blob>} */
    this.files = new Map();
  }

  /**
   * @param {string} path
   * @param {Uint8Array} blob
   * @returns {Promise<number>}
   */
  async appendToFile(path, blob) {
    const existingBlob = this.files.get(path);
    const offset = existingBlob ? existingBlob.size : 0;

    if (existingBlob) {
      // Combine existing blob with new data
      const newBlob = new Blob([existingBlob, blob]);
      this.files.set(path, newBlob);
    } else {
      // Create new file
      this.files.set(path, new Blob([blob]));
    }

    return offset;
  }

  /**
   * @param {string} path
   * @param {number} offset
   * @param {Uint8Array} bytes
   */
  async writeToFileAtOffset(path, offset, bytes) {
    const existingBlob = this.files.get(path);

    if (!existingBlob) {
      // Create new file with data at offset
      if (offset === 0) {
        this.files.set(path, new Blob([bytes]));
      } else {
        // Create file with zeros up to offset, then the data
        const padding = new Uint8Array(offset);
        this.files.set(path, new Blob([padding, bytes]));
      }
      return;
    }

    // Get existing data as array buffer
    const existingBuffer = await existingBlob.arrayBuffer();
    const existingBytes = new Uint8Array(existingBuffer);

    // Determine the new size needed
    const newSize = Math.max(existingBytes.length, offset + bytes.length);
    const newBytes = new Uint8Array(newSize);

    // Copy existing data
    newBytes.set(existingBytes);

    // Write new bytes at offset
    newBytes.set(bytes, offset);

    // Update the file
    this.files.set(path, new Blob([newBytes]));
  }

  /**
   * @param {string} path
   * @returns {Promise<ArrayBuffer|null>}
   */
  async readFile(path) {
    const blob = this.files.get(path);
    if (!blob) {
      return null;
    }
    return await blob.arrayBuffer();
  }

  /**
   * @param {string} path
   * @returns {Promise<number>}
   */
  async getFileSize(path) {
    const blob = this.files.get(path);
    return blob ? blob.size : -1;
  }

  /**
   * @param {string} path
   * @param {number} offset
   * @param {number} size
   * @returns {Promise<Uint8Array>}
   */
  async readFileSegment(path, offset, size) {
    const startTime = performance.now();
    const blob = this.files.get(path);

    if (!blob) {
      throw new Error(`File not found: ${path}`);
    }

    // Create a slice of the blob from offset to offset+size
    const slice = blob.slice(offset, offset + size);
    const data = await slice.arrayBuffer();

    logDur(startTime, `readFileSegment size:${size}`);
    return new Uint8Array(data);
  }

  /**
   * @param {string} path
   * @returns {Promise<boolean>}
   */
  async deleteFile(path) {
    return this.files.delete(path);
  }

  /**
   * @returns {Promise<string[]>}
   */
  async listFiles() {
    return Array.from(this.files.keys());
  }

  /**
   * Clear all files from memory
   * @returns {Promise<void>}
   */
  async clear() {
    this.files.clear();
  }
}
