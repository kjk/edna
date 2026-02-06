import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditor, cleanup, getBlockContent, type TestEditor } from "./utils";

describe("Basic editing (browser tests)", () => {
  let te: TestEditor;
  const isMac = /Mac/.test(navigator.platform);

  beforeEach(() => {
    te = createEditor("\n∞∞∞text-a\n");
    // Position cursor at start of content area
    const blocks = te.editor.getBlocks();
    if (blocks.length > 0) {
      te.editor.setCursorPosition(blocks[0].contentFrom);
    }
  });

  afterEach(() => {
    cleanup(te);
  });

  it("enter text and create new block", async () => {
    const { editor, container } = te;
    expect(editor.getBlocks().length).toBe(1);

    await userEvent.keyboard("Hello World!");
    await userEvent.keyboard("{Enter}");

    const modKey = isMac ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}{Enter}{/${modKey}}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(editor.getBlocks().length).toBe(2);
    expect(getBlockContent(editor, 0)).toBe("Hello World!");
    expect(getBlockContent(editor, 1)).toBe("");

    // check that visual block layers are created
    await expect.poll(() => container.querySelectorAll(".heynote-blocks-layer > div").length).toBe(2);
  });

  it("backspace", async () => {
    const { editor } = te;
    await userEvent.keyboard("Hello World!");
    for (let i = 0; i < 5; i++) {
      await userEvent.keyboard("{Backspace}");
    }
    expect(getBlockContent(editor, 0)).toBe("Hello W");
  });

  it("first block is protected", async () => {
    const { editor } = te;
    const initialContent = editor.getContent();
    await userEvent.keyboard("{Backspace}");
    expect(getBlockContent(editor, 0)).toBe("");
    expect(editor.getContent()).toBe(initialContent);
  });

  it("insert current date and time", async () => {
    const { editor } = te;
    const expectedYear = new Date().toLocaleString(undefined, {
      year: "numeric",
    });
    await userEvent.keyboard("{Alt>}{Shift>}d{/Shift}{/Alt}");
    await expect.poll(() => getBlockContent(editor, 0)).toContain(expectedYear);
    expect(getBlockContent(editor, 0).length).toBeGreaterThan(0);
  });

  it("press tab", async () => {
    const { editor } = te;
    await userEvent.keyboard("H");
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("ello");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Tab}");
    expect(getBlockContent(editor, 0)).toBe("    Hello\n    ");
  });

  it("indentation is preserved on enter in plain text block", async () => {
    const { editor } = te;
    await userEvent.keyboard("    Indented line");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("Next line");
    expect(getBlockContent(editor, 0)).toBe("    Indented line\nNext line");
  });

  it("python indentation increases after colon on enter", async () => {
    const { editor } = te;
    editor.setContent("\n∞∞∞python\ndef func():");
    editor.setCursorPosition(editor.getContent().length);
    editor.view.focus();
    await userEvent.keyboard("{Enter}");
    expect(getBlockContent(editor, 0)).toBe("def func():\n    ");
  });
});
