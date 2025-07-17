// FileSystemWorkerOFS - OPFS operations through a web worker

export class FileSystemWorkerOFS {
  constructor() {
    this.worker = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
    this.initPromise = this.initWorker();
  }

  async initWorker() {
    if (this.worker) return;

    this.worker = new Worker("./fs-worker-ofs-webworker.js", {
      type: "module",
    });

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

  async sendMessage(method, args) {
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

  /**
   * @param {string} path
   * @param {Uint8Array} blob
   * @returns {Promise<number>}
   */
  async appendToFile(path, blob) {
    return await this.sendMessage("appendToFile", {
      path,
      blob: blob,
    });
  }

  /**
   * @param {string} path
   * @param {number} offset
   * @param {Uint8Array} bytes
   */
  async writeToFileAtOffset(path, offset, bytes) {
    await this.sendMessage("writeToFileAtOffset", {
      path,
      offset,
      bytes: bytes,
    });
  }

  /**
   * @param {string} path
   * @returns {Promise<ArrayBuffer|null>}
   */
  async readFile(path) {
    return await this.sendMessage("readFile", { path });
  }

  /**
   * @param {string} path
   * @returns {Promise<number>}
   */
  async getFileSize(path) {
    return await this.sendMessage("getFileSize", { path });
  }

  /**
   * @param {string} path
   * @param {number} offset
   * @param {number} size
   * @returns {Promise<Uint8Array>}
   */
  async readFileSegment(path, offset, size) {
    return await this.sendMessage("readFileSegment", {
      path,
      offset,
      size,
    });
  }

  /**
   * @param {string} path
   */
  async deleteFile(path) {
    await this.sendMessage("deleteFile", { path });
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
