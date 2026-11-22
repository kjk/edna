import { syntaxTreeAvailable } from "@codemirror/language";
import { decode } from "@toon-format/toon";
import { beforeAll, describe, expect, it } from "vitest";
import { getBlocksFromString, getBlocksFromSyntaxTree } from "../../src/editor/block/block-parsing";
import type { NoteBlock } from "../../src/editor/block/block-parsing";
import { cleanup, createEditor } from "./utils";

// generated with: bun run gen:golden
interface GoldenTestData {
  file: string;
  content: string;
  blocks: NoteBlock[];
}

describe("Block parsing with syntax tree (browser tests)", () => {
  let goldenData: GoldenTestData[];

  beforeAll(async () => {
    // Load golden test data in a browser-compatible way
    const response = await fetch("/tests/parse-test-golden.toon");
    const goldenDataRaw = await response.text();
    goldenData = decode(goldenDataRaw) as unknown as GoldenTestData[];
  });

  // Helper to create editor and parse content
  async function parseWithSyntaxTree(content: string): Promise<NoteBlock[]> {
    const te = createEditor(content);
    try {
      const view = te.editor.view;
      await expect.poll(() => syntaxTreeAvailable(view.state, view.state.doc.length), { timeout: 10000 }).toBe(true);
      return getBlocksFromSyntaxTree(view.state);
    } finally {
      cleanup(te);
    }
  }

  it("should parse note-scratch-dev.edna.txt same as getBlocksFromString", async () => {
    const testData = goldenData[0];
    if (!testData) throw new Error("Test data not found");

    const expectedBlocks = testData.blocks;
    const blocksFromString = getBlocksFromString(testData.content);
    const blocksFromSyntaxTree = await parseWithSyntaxTree(testData.content);

    expect(blocksFromSyntaxTree).toEqual(blocksFromString);
    expect(blocksFromSyntaxTree).toEqual(expectedBlocks);
  }, 15000);

  it("should parse note-scratch.edna.txt same as getBlocksFromString", async () => {
    const testData = goldenData[1];
    if (!testData) throw new Error("Test data not found");

    const expectedBlocks = testData.blocks;
    const blocksFromString = getBlocksFromString(testData.content);
    const blocksFromSyntaxTree = await parseWithSyntaxTree(testData.content);

    expect(blocksFromSyntaxTree).toEqual(blocksFromString);
    expect(blocksFromSyntaxTree).toEqual(expectedBlocks);
  }, 15000);
});
