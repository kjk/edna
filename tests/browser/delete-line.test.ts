import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditor, cleanup, getBlockContent, type TestEditor } from "./utils";
import { deleteLine } from "../../src/editor/block/delete-line";

describe("Delete line (browser tests)", () => {
  let te: TestEditor;

  // Note: Mod+Shift+K is removed from Edna's keymap (used for command palette in full app),
  // so we call deleteLine() directly instead of using the keyboard shortcut.

  const threeBlockContent =
    "\n\u221E\u221E\u221Etext\nBlock A\ntext content 1\ntext content 2\ntext content 3\ntext content 4" +
    "\n\u221E\u221E\u221Etext\nBlock B" +
    "\n\u221E\u221E\u221Etext\nBlock C";

  beforeEach(async () => {
    te = createEditor(threeBlockContent);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(te.editor.getBlocks().length).toBe(3);
  });

  afterEach(() => {
    cleanup(te);
  });

  it("delete line on single line in Block A", async () => {
    const { editor } = te;
    // Position cursor at first line of Block A
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom);

    // Delete 4 lines: "Block A", "text content 1", "text content 2", "text content 3"
    for (let i = 0; i < 4; i++) {
      deleteLine(editor.view);
    }

    expect(getBlockContent(editor, 0)).toBe("\ntext content 4");
  });

  it("delete line on selection in Block B", async () => {
    const { editor } = te;
    // Position cursor in Block B
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[1].contentFrom);
    editor.view.focus();

    // Select all in block (Mod+A selects current block)
    const modKey = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}a{/${modKey}}`);

    // Delete selected lines
    deleteLine(editor.view);

    expect(getBlockContent(editor, 1)).toBe("");
  });
});
