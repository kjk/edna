import { syntaxTreeAvailable } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { decode } from "@toon-format/toon";
import { beforeAll, describe, expect, it } from "vitest";
import { getBlocksFromString, getBlocksFromSyntaxTree, getBlocksFromSyntaxTreeNewParser } from "../../src/editor/block/block-parsing";
import type { NoteBlock } from "../../src/editor/block/block-parsing";
import { MultiBlockEditor } from "../../src/editor/editor";

// Golden data uses the old nested format
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

describe("Block parsing with syntax tree (browser tests)", () => {
  let goldenData: GoldenTestData[];

  beforeAll(async () => {
    // Load golden test data in a browser-compatible way
    const response = await fetch("/tests/parse-test-golden.toon");
    const goldenDataRaw = await response.text();
    goldenData = decode(goldenDataRaw) as unknown as GoldenTestData[];
  });

  // Helper function to wait for syntax tree to be available
  async function waitForSyntaxTree(state: EditorState, timeout = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (syntaxTreeAvailable(state, state.doc.length)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  // Helper to create editor and parse content
  async function parseWithSyntaxTree(content: string): Promise<NoteBlock[]> {
    const container = document.createElement("div");
    document.body.appendChild(container);

    try {
      const editor = new MultiBlockEditor({
        element: container,
        save: async () => {},
        setIsDirty: () => {},
        createFindPanel: () => ({ dom: document.createElement("div"), update: () => {} }),
        focus: false,
        useTabs: false,
        tabSize: 4,
      });

      editor.setContent(content);

      // Wait for syntax tree to be available
      const available = await waitForSyntaxTree(editor.view.state, 10000);
      if (!available) {
        throw new Error("Syntax tree did not become available in time");
      }

      const blocks = getBlocksFromSyntaxTree(editor.view.state);
      return blocks;
    } finally {
      container.remove();
    }
  }

  // Helper to create editor with new parser and parse content
  async function parseWithSyntaxTreeNewParser(content: string): Promise<NoteBlock[]> {
    const container = document.createElement("div");
    document.body.appendChild(container);

    try {
      const editor = new MultiBlockEditor({
        element: container,
        save: async () => {},
        setIsDirty: () => {},
        createFindPanel: () => ({ dom: document.createElement("div"), update: () => {} }),
        focus: false,
        useTabs: false,
        tabSize: 4,
        newParser: true,
      });

      editor.setContent(content);

      // Wait for syntax tree to be available
      const available = await waitForSyntaxTree(editor.view.state, 10000);
      if (!available) {
        throw new Error("Syntax tree did not become available in time");
      }

      const blocks = getBlocksFromSyntaxTreeNewParser(editor.view.state);
      return blocks;
    } finally {
      container.remove();
    }
  }

  it("should parse note-scratch-dev.edna.txt same as getBlocksFromString", async () => {
    const testData = goldenData[0];
    if (!testData) throw new Error("Test data not found");

    const expectedBlocks = testData.blocks.map(translateBlock);
    const blocksFromString = getBlocksFromString(testData.content);
    const blocksFromSyntaxTree = await parseWithSyntaxTree(testData.content);

    expect(blocksFromSyntaxTree).toEqual(blocksFromString);
    expect(blocksFromSyntaxTree).toEqual(expectedBlocks);
  }, 15000);

  it("should parse note-scratch.edna.txt same as getBlocksFromString", async () => {
    const testData = goldenData[1];
    if (!testData) throw new Error("Test data not found");

    const expectedBlocks = testData.blocks.map(translateBlock);
    const blocksFromString = getBlocksFromString(testData.content);
    const blocksFromSyntaxTree = await parseWithSyntaxTree(testData.content);

    expect(blocksFromSyntaxTree).toEqual(blocksFromString);
    expect(blocksFromSyntaxTree).toEqual(expectedBlocks);
  }, 15000);

  it("new parser: should parse note-scratch-dev.edna.txt same as getBlocksFromString", async () => {
    const testData = goldenData[0];
    if (!testData) throw new Error("Test data not found");

    const expectedBlocks = testData.blocks.map(translateBlock);
    const blocksFromString = getBlocksFromString(testData.content);
    const blocksFromNewParser = await parseWithSyntaxTreeNewParser(testData.content);

    expect(blocksFromNewParser).toEqual(blocksFromString);
    expect(blocksFromNewParser).toEqual(expectedBlocks);
  }, 15000);

  it("new parser: should parse note-scratch.edna.txt same as getBlocksFromString", async () => {
    const testData = goldenData[1];
    if (!testData) throw new Error("Test data not found");

    const expectedBlocks = testData.blocks.map(translateBlock);
    const blocksFromString = getBlocksFromString(testData.content);
    const blocksFromNewParser = await parseWithSyntaxTreeNewParser(testData.content);

    expect(blocksFromNewParser).toEqual(blocksFromString);
    expect(blocksFromNewParser).toEqual(expectedBlocks);
  }, 15000);
});
