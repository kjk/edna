import { expect, test } from "vitest";
import { mergeMetadata, normalizeMetadata } from "./metadata-merge";

test("normalizeMetadata", () => {
  expect(normalizeMetadata([{ name: "a" }])).toEqual({ ver: 1, notes: [{ name: "a" }], functions: [] });
  expect(normalizeMetadata(null)).toEqual({ ver: 1, notes: [], functions: [] });
  expect(normalizeMetadata({ ver: 1, notes: [{ name: "b" }] })).toEqual({
    ver: 1,
    notes: [{ name: "b" }],
    functions: [],
  });
});

test("mergeMetadata: primary wins, conflicting shortcuts dropped", () => {
  let disk = normalizeMetadata({
    ver: 1,
    notes: [
      { name: "a", isStarred: true },
      { name: "b", altShortcut: "1" },
    ],
    functions: [{ name: "f", isStarred: true }],
  });
  let ls = normalizeMetadata([
    { name: "a", isStarred: false },
    { name: "c", altShortcut: "1", isArchived: true },
    { name: "d", altShortcut: "2" },
  ]);
  let m = mergeMetadata(disk, ls);
  expect(m.notes).toEqual([
    { name: "a", isStarred: true },
    { name: "b", altShortcut: "1" },
    { name: "c", isArchived: true },
    { name: "d", altShortcut: "2" },
  ]);
  expect(m.functions).toEqual([{ name: "f", isStarred: true }]);
});

test("normalizeMetadata: invalid shapes (U8)", () => {
  expect(normalizeMetadata(5)).toEqual({ ver: 1, notes: [], functions: [] });
  expect(normalizeMetadata({ notes: "x", functions: {} })).toEqual({ ver: 1, notes: [], functions: [] });
  expect(normalizeMetadata({ notes: [null, 3, { name: "a" }, { noName: 1 }] }).notes).toEqual([{ name: "a" }]);
});
