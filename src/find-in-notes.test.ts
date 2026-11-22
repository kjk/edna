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

test("a line with multiple matches is reported once, at the first match", () => {
  const res = findMatchesInNote("foo and foo\nbar foo\n", ["foo"], true, false);
  expect(res).toEqual([
    { line: "foo and foo", pos: 0 },
    { line: "bar foo", pos: 16 },
  ]);
});

test("whole word: first non-whole-word occurrence doesn't hide a later whole word on the line", () => {
  const res = findMatchesInNote("foobar foo\n", ["foo"], true, true);
  expect(res).toEqual([{ line: "foobar foo", pos: 7 }]);
});

// toLowerCase() makes "İ" 2 characters: positions must still be in content (U23)
test("positions are in the original content when lower-casing changes length", () => {
  const content = "\n∞∞∞text\nİİİ abc\nxyz abc";
  const res = findMatchesInNote(content, ["abc"], false, false);
  expect(res.map((m) => m.pos)).toEqual([content.indexOf("abc"), content.lastIndexOf("abc")]);
  expect(res[0]!.line).toBe("İİİ abc");
  expect(res[1]!.line).toBe("xyz abc");
});
