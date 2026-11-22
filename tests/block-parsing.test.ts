import { readFileSync } from "fs";
import { decode } from "@toon-format/toon";
import { describe, expect, it } from "vitest";
import { getBlocksFromString, type NoteBlock } from "../src/editor/block/block-parsing";

// generated with: bun run gen:golden
interface GoldenTestData {
  file: string;
  content: string;
  blocks: NoteBlock[];
}

const goldenData = decode(readFileSync("tests/parse-test-golden.toon", "utf-8")) as unknown as GoldenTestData[];

describe.each(goldenData)("Block parsing: $file", (testData) => {
  it("golden data is up to date with the note file", () => {
    expect(readFileSync(testData.file, "utf-8")).toBe(testData.content);
  });

  it("matches golden data", () => {
    const blocks = getBlocksFromString(testData.content);
    // checked separately for a clearer failure message
    expect(blocks.length).toBe(testData.blocks.length);
    expect(blocks).toEqual(testData.blocks);
  });
});
