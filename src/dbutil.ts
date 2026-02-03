import { openDB } from "idb";

export class KV {
  dbName: string;
  storeName: string;
  dbPromise;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.dbPromise = openDB(dbName, 1, {
      upgrade(db) {
        db.createObjectStore(storeName);
      },
    });
  }

  async get(key: string) {
    return (await this.dbPromise).get(this.storeName, key);
  }
  async set(key: string, val: any) {
    let db = await this.dbPromise;
    return db.put(this.storeName, val, key);
  }
  // rejects if already exists
  async add(key: string, val: any) {
    let db = await this.dbPromise;
    return db.add(this.storeName, val, key);
  }
  async del(key: string) {
    let db = await this.dbPromise;
    return db.delete(this.storeName, key);
  }
  async clear() {
    let db = await this.dbPromise;
    return db.clear(this.storeName);
  }
  async keys(): Promise<IDBValidKey[]> {
    let db = await this.dbPromise;
    return db.getAllKeys(this.storeName);
  }
}
