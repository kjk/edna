import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditor, cleanup, getBlockContent, type TestEditor } from "./utils";

describe("Move block (browser tests)", () => {
  let te: TestEditor;
  const isMac = /Mac/.test(navigator.platform);

  const threeBlockContent =
    "\n\u221E\u221E\u221Etext\nBlock A" +
    "\n\u221E\u221E\u221Etext\nBlock B" +
    "\n\u221E\u221E\u221Etext\nBlock C";

  function moveBlockKey(direction: "up" | "down"): string {
    const modKey = isMac ? "Meta" : "Control";
    const arrow = direction === "up" ? "ArrowUp" : "ArrowDown";
    return `{Alt>}{${modKey}>}{Shift>}{${arrow}}{/Shift}{/${modKey}}{/Alt}`;
  }

  beforeEach(async () => {
    te = createEditor(threeBlockContent);
    const { editor } = te;

    // Position cursor at end of last block (Block C)
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[blocks.length - 1].to);
    editor.view.focus();

    expect(editor.getBlocks().length).toBe(3);
  });

  afterEach(() => {
    cleanup(te);
  });

  it("move the first block up", async () => {
    const { editor } = te;
    // Navigate to Block A
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("up"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(editor, 0)).toBe("Block A");
    expect(getBlockContent(editor, 1)).toBe("Block B");
    expect(getBlockContent(editor, 2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("A");
  });

  it("move the middle block up", async () => {
    const { editor } = te;
    // Navigate to Block B
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("up"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(editor, 0)).toBe("Block B");
    expect(getBlockContent(editor, 1)).toBe("Block A");
    expect(getBlockContent(editor, 2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("B");
  });

  it("move the last block up", async () => {
    const { editor } = te;
    // Cursor already at Block C
    await userEvent.keyboard(moveBlockKey("up"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(editor, 0)).toBe("Block A");
    expect(getBlockContent(editor, 1)).toBe("Block C");
    expect(getBlockContent(editor, 2)).toBe("Block B");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("C");
  });

  it("move the first block down", async () => {
    const { editor } = te;
    // Navigate to Block A
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("down"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(editor, 0)).toBe("Block B");
    expect(getBlockContent(editor, 1)).toBe("Block A");
    expect(getBlockContent(editor, 2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("A");
  });

  it("move the middle block down", async () => {
    const { editor } = te;
    // Navigate to Block B
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("down"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(editor, 0)).toBe("Block A");
    expect(getBlockContent(editor, 1)).toBe("Block C");
    expect(getBlockContent(editor, 2)).toBe("Block B");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("B");
  });

  it("move the last block down", async () => {
    const { editor } = te;
    // Cursor already at Block C
    await userEvent.keyboard(moveBlockKey("down"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(editor, 0)).toBe("Block A");
    expect(getBlockContent(editor, 1)).toBe("Block B");
    expect(getBlockContent(editor, 2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("C");
  });

  it("move block down with a selection extending into the next block (U14)", async () => {
    const { EditorSelection } = await import("@codemirror/state");
    const { moveCurrentBlockDown } = await import("../../src/editor/block/commands");
    const t = createEditor("\n∞∞∞text\nA\n∞∞∞text\nB\n∞∞∞text\nC");
    try {
      const view = t.editor.view;
      const s0 = view.state.doc.toString();
      // anchor in the last block, head in the middle block
      view.dispatch({ selection: EditorSelection.range(s0.indexOf("C") + 1, s0.indexOf("B")) });
      expect(moveCurrentBlockDown(view)).toBe(true);
      expect(view.state.doc.toString()).toBe("\n∞∞∞text\nA\n∞∞∞text\nC\n∞∞∞text\nB");
      const sel = view.state.selection.main;
      expect(sel.to).toBeLessThanOrEqual(view.state.doc.length);
    } finally {
      cleanup(t);
    }
  });
});
