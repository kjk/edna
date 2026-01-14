import { expect, test } from "bun:test";
import { fromFileName, isValidFileName, toFileName } from "./filenamify";

const toTest = [
  "%",
  "%0025",
  "lala",
  "lala",
  "con",
  "%0063%006f%006e",
  ".",
  "%002e",
  "..",
  "%002e%002e",
  "foo  ",
  "foo  ",
  "gri<ll",
  "gri%003cll",
  "is%he",
  "is%0025he",
  "og\u009F",
  "og%009f",
  "laé",
  "la%00e9",
  "✨",
  "%2728",
  "draft: hello",
  "draft%003a hello",
];

test("encode", () => {
  let n = toTest.length;
  for (let i = 0; i < n; i += 2) {
    let s = toTest[i];
    let exp = toTest[i + 1];
    let encoded = toFileName(s);
    expect(encoded).toBe(exp);
    let decoded = fromFileName(encoded);
    expect(decoded).toBe(s);
  }
});

test("isValidFileName", () => {
  let notValid = ["con", "✨", ".", "..", "fo%ga", "%", "a%", "%20"];
  for (let s of notValid) {
    expect(isValidFileName(s)).toBeFalse();
  }
  let valid = ["foo", "..."];
  for (let s of valid) {
    expect(isValidFileName(s)).toBeTrue();
  }
  let n = toTest.length;
  for (let i = 0; i < n; i += 2) {
    let s = toTest[i + 1];
    console.log("s:", s);
    expect(isValidFileName(s)).toBeTrue();
  }
});
