import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditor, cleanup, getBlockContent, type TestEditor } from "./utils";

describe("Block creation (browser tests)", () => {
  let te: TestEditor;
  const isMac = /Mac/.test(navigator.platform);

  /** Convert key notation like "Alt+Enter" or "Mod+Shift+Enter" to vitest keyboard syntax */
  function keyToKeyboard(key: string): string {
    const modKey = isMac ? "Meta" : "Control";
    key = key.replace("Mod", modKey);
    const parts = key.split("+");
    const mainKey = parts.pop()!;
    const modifiers = parts;
    let result = "";
    for (const mod of modifiers) {
      result += `{${mod}>}`;
    }
    result += `{${mainKey}}`;
    for (const mod of [...modifiers].reverse()) {
      result += `{/${mod}}`;
    }
    return result;
  }

  async function runTest(key: string, expectedBlocks: string[]) {
    const { editor, container } = te;
    await userEvent.keyboard(keyToKeyboard(key));
    await new Promise((resolve) => setTimeout(resolve, 100));
    await userEvent.keyboard("Block D");

    expect(editor.getBlocks().length).toBe(4);

    for (let i = 0; i < expectedBlocks.length; i++) {
      expect(getBlockContent(editor, i)).toBe(`Block ${expectedBlocks[i]}`);
    }

    // check that only one block delimiter widget has the class first
    await expect
      .poll(() => container.querySelectorAll(".heynote-block-start.first").length)
      .toBe(1);
  }

  const threeBlockContent = `\n\u221E\u221E\u221Etext\nBlock A\n\u221E\u221E\u221Etext\nBlock B\n\u221E\u221E\u221Etext\nBlock C`;

  beforeEach(async () => {
    te = createEditor(threeBlockContent);
    const { editor, container } = te;

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(editor.getBlocks().length).toBe(3);

    // Position cursor at end of last block (Block C)
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[blocks.length - 1].to);
    editor.view.focus();

    // check that visual block layers are created
    await expect
      .poll(() => container.querySelectorAll(".heynote-blocks-layer > div").length)
      .toBe(3);
  });

  afterEach(() => {
    cleanup(te);
  });

  /* from A */
  it("create block before current (A)", async () => {
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowUp}");
    await runTest("Alt+Enter", ["D", "A", "B", "C"]);
  });

  it("create block after current (A)", async () => {
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowUp}");
    await runTest("Mod+Enter", ["A", "D", "B", "C"]);
  });

  /* from B */
  it("create block before current (B)", async () => {
    await userEvent.keyboard("{ArrowUp}");
    await runTest("Alt+Enter", ["A", "D", "B", "C"]);
  });

  it("create block after current (B)", async () => {
    await userEvent.keyboard("{ArrowUp}");
    await runTest("Mod+Enter", ["A", "B", "D", "C"]);
  });

  /* from C */
  it("create block before current (C)", async () => {
    await runTest("Alt+Enter", ["A", "B", "D", "C"]);
  });

  it("create block after current (C)", async () => {
    await runTest("Mod+Enter", ["A", "B", "C", "D"]);
  });

  it("create block before first", async () => {
    await runTest("Alt+Shift+Enter", ["D", "A", "B", "C"]);
  });

  it("create block after last", async () => {
    for (let i = 0; i < 3; i++) {
      await userEvent.keyboard("{ArrowUp}");
    }
    await runTest("Mod+Shift+Enter", ["A", "B", "C", "D"]);
  });

  it("create block before Markdown block", async () => {
    const { editor } = te;
    // Reset with markdown content
    editor.setContent("\n\u221E\u221E\u221Emarkdown\n# Markdown!\n");
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom);
    editor.view.focus();

    await userEvent.keyboard(keyToKeyboard("Alt+Enter"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cursor should be in the newly created block before the markdown block
    const newBlocks = editor.getBlocks();
    expect(newBlocks.length).toBe(2);
    const cursorPos = editor.getCursorPosition();
    // Cursor should be within the first block's content area (the new empty block)
    expect(cursorPos).toBeGreaterThanOrEqual(newBlocks[0].contentFrom);
    expect(cursorPos).toBeLessThanOrEqual(newBlocks[0].to);
  });

  it("create block before first Markdown block", async () => {
    const { editor } = te;
    editor.setContent("\n\u221E\u221E\u221Emarkdown\n# Markdown!\n\u221E\u221E\u221Etext\n");
    const blocks = editor.getBlocks();
    // Position cursor in the second block (text)
    editor.setCursorPosition(blocks[1].contentFrom);
    editor.view.focus();

    await userEvent.keyboard(keyToKeyboard("Alt+Shift+Enter"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cursor should be in the newly created first block
    const newBlocks = editor.getBlocks();
    expect(newBlocks.length).toBe(3);
    const cursorPos = editor.getCursorPosition();
    expect(cursorPos).toBeGreaterThanOrEqual(newBlocks[0].contentFrom);
    expect(cursorPos).toBeLessThanOrEqual(newBlocks[0].to);
  });

  // Note: "test custom default block language" from Heynote is skipped because
  // Edna's block creation commands use hardcoded "text-a" rather than the
  // editor's defaultBlockToken setting, and the test requires UI settings interaction.
});
