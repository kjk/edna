import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { MultiBlockEditor } from "../../src/editor/editor";

describe("Basic editing (browser tests)", () => {
  let editor: MultiBlockEditor;
  let container: HTMLDivElement;
  const isMac = /Mac/.test(navigator.platform);

  function createEditor(initialContent = "\n∞∞∞text-a\n"): MultiBlockEditor {
    container = document.createElement("div");
    document.body.appendChild(container);

    editor = new MultiBlockEditor({
      element: container,
      save: async () => {},
      setIsDirty: () => {},
      createFindPanel: () => ({ dom: document.createElement("div"), update: () => {} }),
      focus: true,
      useTabs: false,
      tabSize: 4,
    });

    editor.setContent(initialContent);

    // Position cursor at start of content area
    const blocks = editor.getBlocks();
    if (blocks.length > 0) {
      editor.setCursorPosition(blocks[0].content.from);
    }

    editor.view.focus();

    return editor;
  }

  function getBlockContent(blockIndex: number): string {
    const blocks = editor.getBlocks();
    const content = editor.getContent();
    expect(blocks.length).toBeGreaterThan(blockIndex);
    const block = blocks[blockIndex];
    return content.slice(block.content.from, block.content.to);
  }

  beforeEach(() => {
    createEditor();
  });

  afterEach(() => {
    if (container) {
      container.remove();
    }
  });

  it("enter text and create new block", async () => {
    expect(editor.getBlocks().length).toBe(1);

    await userEvent.keyboard("Hello World!");
    await userEvent.keyboard("{Enter}");

    const modKey = isMac ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}{Enter}{/${modKey}}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(editor.getBlocks().length).toBe(2);
    expect(getBlockContent(0)).toBe("Hello World!");
    expect(getBlockContent(1)).toBe("");

    // check that visual block layers are created
    await expect.poll(() => container.querySelectorAll(".heynote-blocks-layer > div").length).toBe(2);
  });

  it("backspace", async () => {
    await userEvent.keyboard("Hello World!");
    for (let i = 0; i < 5; i++) {
      await userEvent.keyboard("{Backspace}");
    }
    expect(getBlockContent(0)).toBe("Hello W");
  });

  it("first block is protected", async () => {
    const initialContent = editor.getContent();
    await userEvent.keyboard("{Backspace}");
    expect(getBlockContent(0)).toBe("");
    expect(editor.getContent()).toBe(initialContent);
  });

  it("insert current date and time", async () => {
    const expectedYear = new Date().toLocaleString(undefined, {
      year: "numeric",
    });
    await userEvent.keyboard("{Alt>}{Shift>}d{/Shift}{/Alt}");
    await expect.poll(() => getBlockContent(0)).toContain(expectedYear);
    expect(getBlockContent(0).length).toBeGreaterThan(0);
  });

  it("press tab", async () => {
    await userEvent.keyboard("H");
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("ello");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Tab}");
    expect(getBlockContent(0)).toBe("    Hello\n    ");
  });

  it("indentation is preserved on enter in plain text block", async () => {
    await userEvent.keyboard("    Indented line");
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("Next line");
    expect(getBlockContent(0)).toBe("    Indented line\nNext line");
  });

  it("python indentation increases after colon on enter", async () => {
    editor.setContent("\n∞∞∞python\ndef func():");
    editor.setCursorPosition(editor.getContent().length);
    editor.view.focus();
    await userEvent.keyboard("{Enter}");
    expect(getBlockContent(0)).toBe("def func():\n    ");
  });
});
