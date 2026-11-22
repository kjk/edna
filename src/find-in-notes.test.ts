import { expect, test } from "vitest";
import { findMatchesInNote } from "./find-in-notes";

const note = "\n∞∞∞text\nHello World\nhello again\n";

test("case-insensitive search shows original text", () => {
  const res = findMatchesInNote(note, ["hello"], false, false);
  expect(res.map((m) => m.line)).toEqual(["Hello World", "hello again"]);
  expect(note.slice(res[0]!.pos, res[0]!.pos + 5)).toBe("Hello");
});

test("case-sensitive search", () => {
  const res = findMatchesInNote(note, ["Hello"], true, false);
  expect(res.map((m) => m.line)).toEqual(["Hello World"]);
});

test("all parts must be on the same line", () => {
  expect(findMatchesInNote(note, ["hello", "world"], false, false).map((m) => m.line)).toEqual(["Hello World"]);
});

test("whole word", () => {
  expect(findMatchesInNote("foobar\nfoo bar\n", ["foo"], true, true).map((m) => m.line)).toEqual(["foo bar"]);
});

test("maxResults", () => {
  expect(findMatchesInNote("a\na\na\n", ["a"], true, false, 2).length).toBe(2);
});

test("block delimiter lines are not matched", () => {
  const s = "\n\u221E\u221E\u221Emarkdown\n# markdown notes\n\u221E\u221E\u221Emarkdown-a\nmore\n";
  expect(findMatchesInNote(s, ["markdown"], false, false).map((m) => m.line)).toEqual(["# markdown notes"]);
});
