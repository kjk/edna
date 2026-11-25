import { syntaxTreeAvailable } from "@codemirror/language";
import { decode } from "@toon-format/toon";
import { beforeAll, describe, expect, it } from "vitest";
import { getBlocksFromString, type NoteBlock } from "../../src/block-format";
import { getBlocksFromSyntaxTree } from "../../src/editor/block/block-parsing";
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

  it.each([
    { idx: 0, file: "note-scratch-dev.edna.txt" },
    { idx: 1, file: "note-scratch.edna.txt" },
  ])(
    "should parse $file same as getBlocksFromString",
    async ({ idx }) => {
      const testData = goldenData[idx];
      if (!testData) throw new Error("Test data not found");

      const expectedBlocks = testData.blocks;
      const blocksFromString = getBlocksFromString(testData.content);
      const blocksFromSyntaxTree = await parseWithSyntaxTree(testData.content);

      expect(blocksFromSyntaxTree).toEqual(blocksFromString);
      expect(blocksFromSyntaxTree).toEqual(expectedBlocks);
    },
    15000,
  );
});
