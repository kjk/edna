import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import {
  cursorDocStart,
  cursorDocEnd,
  selectDocStart,
  selectDocEnd,
} from "@codemirror/commands";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Cursor document navigation (browser tests)", () => {
  let te: TestEditor;

  const threeBlockContent = [
    "\n\u221E\u221E\u221Etext",
    "\nFirst block content",
    "\n\u221E\u221E\u221Ejavascript",
    '\nconsole.log("second block")',
    "\n\u221E\u221E\u221Emarkdown",
    "\n# Third block",
    "\nSome markdown content\n",
  ].join("");

  function getSelectedText(): string {
    const state = te.editor.view.state;
    const sel = state.selection.main;
    return state.doc.sliceString(sel.from, sel.to);
  }

  afterEach(() => {
    cleanup(te);
  });

  it("cursorDocStart moves to beginning of document", async () => {
    te = createEditor(threeBlockContent);
    const { editor } = te;

    // Move cursor to the end of the document
    cursorDocEnd(editor.view);

    // Move cursor to the beginning of the document
    cursorDocStart(editor.view);

    // Verify cursor is at the beginning of the first block's content
    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].contentFrom);
  });

  it("cursorDocEnd moves to end of document", async () => {
    te = createEditor(threeBlockContent);
    const { editor } = te;

    // Move cursor to the beginning of the document
    cursorDocStart(editor.view);

    // Move cursor to the end of the document
    cursorDocEnd(editor.view);

    // Verify cursor is at the end
    expect(editor.getCursorPosition()).toBe(editor.getContent().length);
  });

  it("selectDocStart selects from cursor to beginning of document", async () => {
    te = createEditor(threeBlockContent);
    const { editor } = te;
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Position cursor in the middle of the document (in the second block)
    const blocks = editor.getBlocks();
    const secondBlock = blocks[1];
    const midPos = Math.floor((secondBlock.contentFrom + secondBlock.to) / 2);
    editor.setCursorPosition(midPos);

    // Select from cursor to beginning of document
    selectDocStart(editor.view);

    // Should select text from cursor position back to beginning
    const selectedText = getSelectedText();
    expect(selectedText.length).toBeGreaterThan(0);
    expect(selectedText).toContain("First block content");
  });

  it("selectDocEnd selects from cursor to end of document", async () => {
    te = createEditor(threeBlockContent);
    const { editor } = te;

    // Move cursor to the beginning, then forward 15 chars
    cursorDocStart(editor.view);
    for (let i = 0; i < 15; i++) {
      await userEvent.keyboard("{ArrowRight}");
    }

    // Select from cursor to end of document
    selectDocEnd(editor.view);

    // Should select text from cursor position to end
    const selectedText = getSelectedText();
    expect(selectedText.length).toBeGreaterThan(0);
    expect(selectedText).toContain("console.log");
    expect(selectedText).toContain("Some markdown content");
  });

  it("cursor navigation works with empty blocks", async () => {
    te = createEditor(
      "\n\u221E\u221E\u221Etext\n\n\u221E\u221E\u221Ejavascript\n\n\u221E\u221E\u221Emarkdown\n",
    );
    const { editor } = te;

    // Test moving to beginning
    cursorDocEnd(editor.view);
    cursorDocStart(editor.view);

    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].contentFrom);

    // Test moving to end
    cursorDocEnd(editor.view);
    expect(editor.getCursorPosition()).toBe(editor.getContent().length);
  });

  it("cursor cannot be set within block delimiter", async () => {
    te = createEditor("\n\u221E\u221E\u221Etext\nhello");
    const { editor } = te;

    // Try to set cursor at position 0, which is inside the block delimiter
    editor.setCursorPosition(0);

    // Cursor should be clamped to the start of the block's content range
    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].contentFrom);
  });

  it("cursor navigation works in single block", async () => {
    te = createEditor("\n\u221E\u221E\u221Etext\nSingle block with some content\n");
    const { editor } = te;

    // Move to middle of block
    cursorDocStart(editor.view);
    for (let i = 0; i < 10; i++) {
      await userEvent.keyboard("{ArrowRight}");
    }

    // Test Home
    cursorDocStart(editor.view);
    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].contentFrom);

    // Test End
    cursorDocEnd(editor.view);
    expect(editor.getCursorPosition()).toBe(editor.getContent().length);
  });
});
