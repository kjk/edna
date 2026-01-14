// FileSystemWorkerOFS - OPFS operations through a web worker

export class FileSystemWorkerOFS {
  worker: Worker;
  messageId: number;
  pendingRequests: Map<any, any>;
  initPromise: Promise<void>;

  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.initPromise = this.initWorker();
  }

  async initWorker() {
    if (this.worker) return;

    const workerUrl = new URL("./fs-worker-ofs-webworker.js", import.meta.url);
    this.worker = new Worker(workerUrl, { type: "module" });

    this.worker.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      const request = this.pendingRequests.get(id);

      if (request) {
        this.pendingRequests.delete(id);

        if (success) {
          request.resolve(result);
        } else {
          const err = new Error(error.message);
          err.stack = error.stack;
          request.reject(err);
        }
      }
    };

    this.worker.onerror = (error) => {
      console.error("Worker error:", error);
      // Reject all pending requests
      for (const request of this.pendingRequests.values()) {
        request.reject(new Error("Worker error"));
      }
      this.pendingRequests.clear();
    };
  }

  async sendMessage(method: string, args: any) {
    await this.initPromise;

    const id = ++this.messageId;
    const transferables = [];

    // Prepare transferable objects for better performance
    if (args.blob && args.blob instanceof Uint8Array) {
      transferables.push(args.blob.buffer);
    }
    if (args.bytes && args.bytes instanceof Uint8Array) {
      transferables.push(args.bytes.buffer);
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage(
        {
          id,
          method,
          args,
        },
        transferables,
      );
    });
  }

  async appendToFile(path: string, blob: Uint8Array): Promise<number> {
    return await this.sendMessage("appendToFile", {
      path,
      blob: blob,
    });
  }

  async writeToFileAtOffset(path: string, offset: number, bytes: Uint8Array) {
    await this.sendMessage("writeToFileAtOffset", {
      path,
      offset,
      bytes: bytes,
    });
  }

  async readFile(path: string): Promise<ArrayBuffer | null> {
    return await this.sendMessage("readFile", { path });
  }

  async getFileSize(path: string): Promise<number> {
    return await this.sendMessage("getFileSize", { path });
  }

  async readFileSegment(
    path: string,
    offset: number,
    size: number,
  ): Promise<Uint8Array> {
    return await this.sendMessage("readFileSegment", {
      path,
      offset,
      size,
    });
  }

  async deleteFile(path: string) {
    await this.sendMessage("deleteFile", { path });
  }

  async renameFile(oldPath: any, newPath: any) {
    await this.sendMessage("renameFile", {
      oldPath,
      newPath,
    });
  }

  /**
   * Terminate the worker and clean up resources
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending requests
    for (const request of this.pendingRequests.values()) {
      request.reject(new Error("FileSystemWorkerOFS destroyed"));
    }
    this.pendingRequests.clear();
  }
}

let fs: FileSystemWorkerOFS;

export async function getFileSystemWorkerOfs(): Promise<FileSystemWorkerOFS> {
  if (!fs) {
    fs = new FileSystemWorkerOFS();
    await fs.initWorker();
  }
  return fs;
}
