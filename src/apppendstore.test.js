import test from "node:test";
import {
  AppendStore,
  AppendStoreRecord,
  kFileSystemMem,
  kFileSystemOFS,
  kFileSystemWorkerOFS,
} from "./appendstore";
import { genRandomID } from "./nanoid";
import { logDur, throwIf } from "./util";

/** @typedef {{kind: string, meta: string | null, data: string}} TestRecord */
/**
 * Generates an array of test records.
 * @param {number} n
 * @returns {TestRecord[]}
 */
function genTestRecords(n) {
  return Array.from({ length: n }, (_, i) => ({
    kind: `test-kind-${i % 13}`,
    meta: i % 5 === 0 ? null : `meta-${(i % 8) + 4}`,
    data: genRandomID((i + 8) % 256),
  }));
}

/**
 * Verifies that the records in the store match the expected test records.
 * @param {AppendStore} store
 * @param {AppendStoreRecord[]} recs
 * @param {TestRecord[]} trecs
 */
async function verifyRecs(store, recs, trecs) {
  let nRecs = trecs.length;
  throwIf(
    recs.length !== nRecs,
    `expected ${nRecs} records, got ${recs.length}`,
  );
  for (let i = 0; i < nRecs; i++) {
    let rec = recs[i];
    let trec = trecs[i];
    let data = await store.readRecordAsString(rec);
    throwIf(
      rec.kind !== trec.kind || rec.meta !== trec.meta || data !== trec.data,
      `Record ${i} does not match: expected ${JSON.stringify(trec)}, got ${JSON.stringify(rec)}`,
    );
  }
}

/**
 * Gets the last record from the store.
 * @param {AppendStore} store
 * @returns {AppendStoreRecord | null}
 */
function getLastRecord(store) {
  const recs = store.records();
  return recs.length > 0 ? recs[recs.length - 1] : null;
}

/**
 * @param {string} fsType
 * @param {string} prefix
 */
export async function testAppendOverwrite(fsType, prefix) {
  let store = await AppendStore.create(prefix, fsType, true);
  store.overWriteDataExpandPercent = 100;
  let kind = "file";
  let meta = "foo.txt";
  let d = "lala";
  await store.overWriteRecord(kind, meta, d);

  let rec1 = getLastRecord(store);
  {
    let rec = rec1;
    let data = await store.readRecordAsString(rec);
    throwIf(
      rec.kind !== kind || rec.meta !== meta || data !== d,
      `Overwritten record does not match: expected {kind: ${kind}, meta: ${meta}, data: ${d}}, got {kind: ${rec.kind}, meta: ${rec.meta}, data: ${data}}`,
    );
    throwIf(
      rec.size * 2 == rec.sizeInFile,
      `Overwritten record sizeInFile should be double the size, but got ${rec.sizeInFile} for size ${rec.size}`,
    );
  }
  d = "lalalala2";
  await store.overWriteRecord(kind, meta, d);
  {
    let rec = getLastRecord(store);
    let data = await store.readRecordAsString(rec);
    throwIf(
      rec.kind !== kind || rec.meta !== meta || data !== d,
      `Overwritten record does not match: expected {kind: ${kind}, meta: ${meta}, data: ${d}}, got {kind: ${rec.kind}, meta: ${rec.meta}, data: ${data}}`,
    );
    throwIf(
      rec.size * 2 == rec.sizeInFile,
      `Overwritten record sizeInFile should be double the size, but got ${rec.sizeInFile} for size ${rec.size}`,
    );
  }

  d = "lolahi";
  await store.overWriteRecord(kind, meta, d);
  {
    let rec = getLastRecord(store);
    let data = await store.readRecordAsString(rec);
    throwIf(
      rec.kind !== kind || rec.meta !== meta || data !== d,
      `Overwritten record does not match: expected {kind: ${kind}, meta: ${meta}, data: ${d}}, got {kind: ${rec.kind}, meta: ${rec.meta}, data: ${data}}`,
    );
    throwIf(
      rec.size * 2 == rec.sizeInFile,
      `Overwritten record sizeInFile should be double the size, but got ${rec.sizeInFile} for size ${rec.size}`,
    );
    throwIf(rec1.overWritten !== true, `Expected rec1 to be overwritten`);
  }
  // verify overwritten records recognized when reading all records
  store = await AppendStore.create(prefix, fsType, false);
  let recs = store.records();
  throwIf(
    recs.length !== 2,
    `Expected 2 records after overwriting, got ${recs.length}`,
  );
  throwIf(
    store._allRecords.length !== 3,
    `Expected 3 all records after overwriting, got ${store._allRecords.length}`,
  );
  let rec = recs[0];
  throwIf(!rec.overWritten, `Expected first record to be overwritten`);
}

/**
 * @param {string} fsType
 * @param {string} prefix
 */
async function testAppendMany(fsType, prefix) {
  const startTime = performance.now();
  let trecs = genTestRecords(500);
  console.log("Testing AppendStore...");
  let store = await AppendStore.create(prefix, fsType, true);
  let i = 0;
  for (let rec of trecs) {
    await store.appendRecord(rec.kind, rec.meta, rec.data);
    if (i % 250 === 0) {
      logDur(startTime, `appended ${i} records`);
    }
    i++;
  }
  logDur(startTime, `appended ${i} records`);
  console.log("Verifying records...");
  let recs = store.records();
  await verifyRecs(store, recs, trecs);

  // we can't re-open in-memory store
  if (fsType === kFileSystemMem) {
    logDur(startTime, `AppendStore tests finished.`);
    return;
  }

  // re-open the store to verify persistence
  console.log("Verifying record after re-opening store...");
  store = await AppendStore.create(prefix, fsType, false);
  recs = store.records();
  await verifyRecs(store, recs, trecs);
}
/**
 * @param {string} fsType
 * @param {string} prefix
 */
export async function testAppendStoreWithFS(fsType, prefix) {
  const startTime = performance.now();
  testAppendOverwrite(fsType, prefix);
  testAppendMany(fsType, prefix);

  // delete the store
  await AppendStore.create(prefix, fsType, true);

  logDur(startTime, `AppendStore tests finished.`);
}

export async function testAppendStore() {
  console.log("Testing AppendStore with FileSystemWorkerOFS...");
  await testAppendStoreWithFS(kFileSystemWorkerOFS, "as_test_workerofs_");

  // console.log("Testing AppendStore with FileSystemMem...");
  // await testAppendStoreWithFS(kFileSystemMem, "as_test_mem_");

  let isSafari =
    navigator.userAgent.includes("Safari") &&
    !navigator.userAgent.includes("Chrome");
  if (isSafari) {
    console.log(
      "Skipping FileSystemOFS test on Safari because it doesn't support createWritable().",
    );
  } else {
    console.log("Testing AppendStore with FileSystemOFS...");
    await testAppendStoreWithFS(kFileSystemOFS, "as_test_ofs_");
  }

  console.log("All AppendStore tests passed.");
}
