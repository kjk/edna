export class FileSystemMem {
  files: Map<string, Blob>;

  constructor() {
    this.files = new Map();
  }

  async appendToFile(path: string, blob: Uint8Array): Promise<number> {
    const existingBlob = this.files.get(path);
    const offset = existingBlob ? existingBlob.size : 0;

    if (existingBlob) {
      // Combine existing blob with new data
      // @ts-ignore
      const newBlob = new Blob([existingBlob, blob]);
      this.files.set(path, newBlob);
    } else {
      // Create new file
      // @ts-ignore
      this.files.set(path, new Blob([blob]));
    }

    return offset;
  }

  async writeToFileAtOffset(path: string, offset: number, bytes: Uint8Array) {
    const existingBlob = this.files.get(path);

    if (!existingBlob) {
      // Create new file with data at offset
      if (offset === 0) {
        // @ts-ignore
        this.files.set(path, new Blob([bytes]));
      } else {
        // Create file with zeros up to offset, then the data
        const padding = new Uint8Array(offset);
        // @ts-ignore
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

  async readFile(path: string): Promise<ArrayBuffer | null> {
    const blob = this.files.get(path);
    if (!blob) {
      return null;
    }
    return await blob.arrayBuffer();
  }

  async getFileSize(path: string): Promise<number> {
    const blob = this.files.get(path);
    return blob ? blob.size : -1;
  }

  async readFileSegment(path: string, offset: number, size: number): Promise<Uint8Array> {
    // const startTime = performance.now();
    const blob = this.files.get(path);

    if (!blob) {
      throw new Error(`File not found: ${path}`);
    }

    // Create a slice of the blob from offset to offset+size
    const slice = blob.slice(offset, offset + size);
    const data = await slice.arrayBuffer();

    // logDur(startTime, `readFileSegment size:${size}`);
    return new Uint8Array(data);
  }

  async deleteFile(path: string): Promise<boolean> {
    return this.files.delete(path);
  }

  async listFiles(): Promise<string[]> {
    return Array.from(this.files.keys());
  }

  // Clear all files from memory
  async clear(): Promise<void> {
    this.files.clear();
  }
}
