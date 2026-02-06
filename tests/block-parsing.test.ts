import { readFileSync } from "fs";
import { decode } from "@toon-format/toon";
import { beforeAll, describe, expect, it } from "vitest";
import { getBlocksFromString } from "../src/editor/block/block-parsing";
import type { NoteBlock } from "../src/editor/block/block-parsing";

// Golden data uses the old nested format; translate to the new flat format
interface OldNoteBlock {
  index: number;
  range: { from: number; to: number };
  content: { from: number; to: number };
  delimiter: { from: number; to: number };
  language: string;
  autoDetect: boolean;
}

interface GoldenTestData {
  file: string;
  content: string;
  blocks: OldNoteBlock[];
}

function translateBlock(old: OldNoteBlock): NoteBlock {
  return {
    index: old.index,
    from: old.range.from,
    to: old.range.to,
    contentFrom: old.content.from,
    language: old.language,
    autoDetect: old.autoDetect,
  };
}

describe("Block parsing tests (Node.js)", () => {
  // Load golden test data
  const goldenDataRaw = readFileSync("tests/parse-test-golden.toon", "utf-8");
  const goldenData = decode(goldenDataRaw) as unknown as GoldenTestData[];

  describe("note-scratch-dev.edna.txt", () => {
    const testData = goldenData[0]!;
    if (!testData) throw new Error("Test data not found");

    // Parse once and reuse for all tests
    const blocks = getBlocksFromString(testData.content);
    const expectedBlocks = testData.blocks.map(translateBlock);

    it("should parse the correct number of blocks", () => {
      expect(blocks.length).toBe(expectedBlocks.length);
    });

    it("should parse blocks with correct language and autoDetect", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = expectedBlocks[i];
        if (!block || !expected) continue;

        expect(block.language).toBe(expected.language);
        expect(block.autoDetect).toBe(expected.autoDetect);
      }
    });

    it("should parse blocks with correct ranges", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = expectedBlocks[i];
        if (!block || !expected) continue;

        expect(block.contentFrom).toBe(expected.contentFrom);
        expect(block.to).toBe(expected.to);
        expect(block.from).toBe(expected.from);
      }
    });

    it("should parse blocks with correct index", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block) continue;
        expect(block.index).toBe(i);
      }
    });

    it("should match golden data exactly", () => {
      expect(blocks).toEqual(expectedBlocks);
    });
  });

  describe("note-scratch.edna.txt", () => {
    const testData = goldenData[1]!;
    if (!testData) throw new Error("Test data not found");

    // Parse once and reuse for all tests
    const blocks = getBlocksFromString(testData.content);
    const expectedBlocks = testData.blocks.map(translateBlock);

    it("should parse the correct number of blocks", () => {
      expect(blocks.length).toBe(expectedBlocks.length);
    });

    it("should parse blocks with correct language and autoDetect", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = expectedBlocks[i];
        if (!block || !expected) continue;

        expect(block.language).toBe(expected.language);
        expect(block.autoDetect).toBe(expected.autoDetect);
      }
    });

    it("should parse blocks with correct ranges", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = expectedBlocks[i];
        if (!block || !expected) continue;

        expect(block.contentFrom).toBe(expected.contentFrom);
        expect(block.to).toBe(expected.to);
        expect(block.from).toBe(expected.from);
      }
    });

    it("should parse blocks with correct index", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (!block) continue;
        expect(block.index).toBe(i);
      }
    });

    it("should match golden data exactly", () => {
      expect(blocks).toEqual(expectedBlocks);
    });
  });
});
