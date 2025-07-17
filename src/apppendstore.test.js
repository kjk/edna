import { AppendStore } from "./appendstore";
import { throwIf } from "./util";

export async function testAppendStore() {
  console.log("Testing AppendStore...");
  const store = await AppendStore.create("testAppendStore", true);
  await store.appendRecord("test1", "kind");
  let recs = store.records();
  throwIf(recs.length !== 1, `expected 1 record, got ${recs.length}`);
  console.log("AppendStore test passed.");
}
