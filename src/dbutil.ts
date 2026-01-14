import { openDB } from "idb";

export class KV {
  /** @type {string} */
  dbName;
  /** @type {string} */
  storeName;
  dbPromise;

  /**
   * @param {string} dbName
   * @param {string} storeName
   */
  constructor(dbName, storeName) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.dbPromise = openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore(storeName);
      },
    });
  }

  /**
   * @param {string} key
   */
  async get(key) {
    return (await this.dbPromise).get(this.storeName, key);
  }
  /**
   * @param {string} key
   * @param {any} val
   */
  async set(key, val) {
    let db = await this.dbPromise;
    return db.put(this.storeName, val, key);
  }
  /**
   * rejects if already exists
   * @param {string} key
   * @param {any} val
   */
  async add(key, val) {
    let db = await this.dbPromise;
    return db.add(this.storeName, val, key);
  }
  /**
   * @param {string} key
   */
  async del(key) {
    let db = await this.dbPromise;
    return db.delete(this.storeName, key);
  }
  async clear() {
    let db = await this.dbPromise;
    return db.clear(this.storeName);
  }
  /**
   * @returns {Promise<IDBValidKey[]>}
   */
  async keys() {
    let db = await this.dbPromise;
    return db.getAllKeys(this.storeName);
  }
}
