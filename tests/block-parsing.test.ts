import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { decode } from "@toon-format/toon";
import { getBlocksFromString } from "../src/editor/block/block-parsing";
import type { NoteBlock } from "../src/editor/block/block-parsing";

interface GoldenTestData {
  file: string;
  content: string;
  blocks: NoteBlock[];
}

describe("Block parsing tests", () => {
  // Load golden test data
  const goldenDataRaw = readFileSync("tests/parse-test-golden.toon", "utf-8");
  const goldenData = decode(goldenDataRaw) as GoldenTestData[];

  describe("note-scratch-dev.edna.txt", () => {
    const testData = goldenData[0];
    if (!testData) throw new Error("Test data not found");

    // Parse once and reuse for all tests
    const blocks = getBlocksFromString(testData.content);

    it("should parse the correct number of blocks", () => {
      expect(blocks.length).toBe(testData.blocks.length);
    });

    it("should parse blocks with correct language and autoDetect", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = testData.blocks[i];
        if (!block || !expected) continue;

        expect(block.language).toBe(expected.language);
        expect(block.autoDetect).toBe(expected.autoDetect);
      }
    });

    it("should parse blocks with correct ranges", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = testData.blocks[i];
        if (!block || !expected) continue;

        expect(block.content.from).toBe(expected.content.from);
        expect(block.content.to).toBe(expected.content.to);
        expect(block.delimiter.from).toBe(expected.delimiter.from);
        expect(block.delimiter.to).toBe(expected.delimiter.to);
        expect(block.range.from).toBe(expected.range.from);
        expect(block.range.to).toBe(expected.range.to);
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
      expect(blocks).toEqual(testData.blocks);
    });
  });

  describe("note-scratch.edna.txt", () => {
    const testData = goldenData[1];
    if (!testData) throw new Error("Test data not found");

    // Parse once and reuse for all tests
    const blocks = getBlocksFromString(testData.content);

    it("should parse the correct number of blocks", () => {
      expect(blocks.length).toBe(testData.blocks.length);
    });

    it("should parse blocks with correct language and autoDetect", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = testData.blocks[i];
        if (!block || !expected) continue;

        expect(block.language).toBe(expected.language);
        expect(block.autoDetect).toBe(expected.autoDetect);
      }
    });

    it("should parse blocks with correct ranges", () => {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const expected = testData.blocks[i];
        if (!block || !expected) continue;

        expect(block.content.from).toBe(expected.content.from);
        expect(block.content.to).toBe(expected.content.to);
        expect(block.delimiter.from).toBe(expected.delimiter.from);
        expect(block.delimiter.to).toBe(expected.delimiter.to);
        expect(block.range.from).toBe(expected.range.from);
        expect(block.range.to).toBe(expected.range.to);
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
      expect(blocks).toEqual(testData.blocks);
    });
  });
});
