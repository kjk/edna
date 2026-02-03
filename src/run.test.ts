import { expect, test } from "bun:test";
import { evalResultToString, runJSWithArg } from "./run";

let code = `
function main(s) {
  let parts = s.split("\\n");
  parts.sort();
  return parts.join("\\n");
}`;

test("runJSWithArg", async () => {
  let arg = `zebra
anna`;
  let res = await runJSWithArg(code, arg);
  let resTxt = evalResultToString(res);
  expect(resTxt).toBe("anna\nzebra");
});
