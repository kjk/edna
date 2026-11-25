import { expect, test } from "vitest";
import { getBlocksFromString } from "./block-format";
import { fixUpNoteContent } from "./note-content";

const D = "∞∞∞";

// stored content becomes a valid document (docs/state-machines.md U9)
test("fixUpNoteContent", () => {
  const cases: [string | null, string][] = [
    [null, `\n${D}markdown\n`],
    ["", `\n${D}markdown\n`],
    ["hello", `\n${D}markdown\nhello`],
    [`\n${D}text\nhi`, `\n${D}text\nhi`],
    [`\n${D}text`, `\n${D}text\n`],
    [`\n${D}Text\nhi`, `\n${D}text\nhi`],
    [`\n${D}text-a;created=2024-01-01\nhi\n${D}math;created=x\n1+1`, `\n${D}text-a\nhi\n${D}math\n1+1`],
    [`${D}text\nlegacy`, `\n${D}text\nlegacy`],
    [`\r\n${D}text\r\na\r\nb`, `\n${D}text\na\nb`],
    [`junk\n${D}text\nhello`, `\n${D}markdown\njunk\n${D}text\nhello`],
  ];
  for (let [input, want] of cases) {
    let got = fixUpNoteContent(input);
    expect(got, JSON.stringify(input)).toBe(want);
    expect(getBlocksFromString(got).length, JSON.stringify(input)).toBeGreaterThan(0);
    expect(getBlocksFromString(got)[0].from).toBe(0);
    // idempotent
    expect(fixUpNoteContent(got)).toBe(got);
  }
});
