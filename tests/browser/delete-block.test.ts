import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createEditor, cleanup, type TestEditor } from "./utils";
import { deleteBlock } from "../../src/editor/block/commands";

describe("Delete block (browser tests)", () => {
  let te: TestEditor;

  // \n∞∞∞text\nBlock A\n∞∞∞markdown\nBlock B\n∞∞∞text\nBlock C
  // Positions: delimiter0(0-8) content0(9-15) delimiter1(16-28) content1(29-35) delimiter2(36-44) content2(45-51)
  const threeBlockContent =
    "\n\u221E\u221E\u221Etext\nBlock A" +
    "\n\u221E\u221E\u221Emarkdown\nBlock B" +
    "\n\u221E\u221E\u221Etext\nBlock C";

  beforeEach(async () => {
    te = createEditor(threeBlockContent);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(te.editor.getBlocks().length).toBe(3);
  });

  afterEach(() => {
    cleanup(te);
  });

  it("delete first block", async () => {
    const { editor } = te;
    editor.setCursorPosition(10); // in "Block A"
    deleteBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(editor.getBlocks().length).toBe(2);
    // Cursor should be at start of what was the second block's content
    expect(editor.getCursorPosition()).toBe(13);
  });

  it("delete middle block", async () => {
    const { editor } = te;
    editor.setCursorPosition(32); // in "Block B"
    deleteBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(editor.getBlocks().length).toBe(2);
    // Cursor should be at start of what was the third block's content
    expect(editor.getCursorPosition()).toBe(25);
  });

  it("delete last block", async () => {
    const { editor } = te;
    editor.setCursorPosition(52); // end of "Block C"
    deleteBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(editor.getBlocks().length).toBe(2);
    // Cursor should be at end of what was the second block
    expect(editor.getCursorPosition()).toBe(36);
  });
});
