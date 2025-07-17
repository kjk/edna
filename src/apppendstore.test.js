import {
  AppendStore,
  AppendStoreRecord,
  kFileSystemMem,
  kFileSystemOFS,
} from "./appendstore";
import { logDur, throwIf } from "./util";

import { genRandomID } from "./nanoid";

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
export async function testAppendStoreWithFS(fsType) {
  const startTime = performance.now();
  let trecs = genTestRecords(1000);
  const prefix = "testAppendStore_";
  console.log("Testing AppendStore...");
  let store = await AppendStore.create(prefix, true, fsType);
  let i = 0;
  for (let rec of trecs) {
    await store.appendRecord(rec.data, rec.kind, rec.meta);
    if (i % 100 === 0) {
      logDur(startTime, `appended ${i} records`);
    }
    i++;
  }
  logDur(startTime, `appended ${i} records`);
  console.log("Verifying records...");
  let recs = store.records();
  verifyRecs(store, recs, trecs);

  // we can't re-open in-memory store
  if (fsType === kFileSystemMem) {
    logDur(startTime, `AppendStore tests finished.`);
    return;
  }

  // re-open the store to verify persistence
  console.log("Verifying record after re-opening store...");
  store = await AppendStore.create(prefix, false, fsType);
  recs = store.records();
  verifyRecs(store, recs, trecs);

  logDur(startTime, `AppendStore tests finished.`);
}

export async function testAppendStore() {
  console.log("Testing AppendStore with FileSystemMem...");
  await testAppendStoreWithFS("mem");
  console.log("Testing AppendStore with FileSystemOFS...");
  await testAppendStoreWithFS(kFileSystemOFS);
  console.log("All AppendStore tests passed.");
}
