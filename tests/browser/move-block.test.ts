import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { MultiBlockEditor } from "../../src/editor/editor";

describe("Move block (browser tests)", () => {
  let editor: MultiBlockEditor;
  let container: HTMLDivElement;
  const isMac = /Mac/.test(navigator.platform);

  const threeBlockContent =
    "\n\u221E\u221E\u221Etext\nBlock A" +
    "\n\u221E\u221E\u221Etext\nBlock B" +
    "\n\u221E\u221E\u221Etext\nBlock C";

  function getBlockContent(blockIndex: number): string {
    const blocks = editor.getBlocks();
    const content = editor.getContent();
    expect(blocks.length).toBeGreaterThan(blockIndex);
    const block = blocks[blockIndex];
    return content.slice(block.content.from, block.content.to);
  }

  function moveBlockKey(direction: "up" | "down"): string {
    const modKey = isMac ? "Meta" : "Control";
    const arrow = direction === "up" ? "ArrowUp" : "ArrowDown";
    return `{Alt>}{${modKey}>}{Shift>}{${arrow}}{/Shift}{/${modKey}}{/Alt}`;
  }

  beforeEach(async () => {
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

    editor.setContent(threeBlockContent);

    // Position cursor at end of last block (Block C)
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[blocks.length - 1].content.to);
    editor.view.focus();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(editor.getBlocks().length).toBe(3);
  });

  afterEach(() => {
    if (container) container.remove();
  });

  it("move the first block up", async () => {
    // Navigate to Block A
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("up"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(0)).toBe("Block A");
    expect(getBlockContent(1)).toBe("Block B");
    expect(getBlockContent(2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("A");
  });

  it("move the middle block up", async () => {
    // Navigate to Block B
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("up"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(0)).toBe("Block B");
    expect(getBlockContent(1)).toBe("Block A");
    expect(getBlockContent(2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("B");
  });

  it("move the last block up", async () => {
    // Cursor already at Block C
    await userEvent.keyboard(moveBlockKey("up"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(0)).toBe("Block A");
    expect(getBlockContent(1)).toBe("Block C");
    expect(getBlockContent(2)).toBe("Block B");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("C");
  });

  it("move the first block down", async () => {
    // Navigate to Block A
    await userEvent.keyboard("{ArrowUp}");
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("down"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(0)).toBe("Block B");
    expect(getBlockContent(1)).toBe("Block A");
    expect(getBlockContent(2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("A");
  });

  it("move the middle block down", async () => {
    // Navigate to Block B
    await userEvent.keyboard("{ArrowUp}");

    await userEvent.keyboard(moveBlockKey("down"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(0)).toBe("Block A");
    expect(getBlockContent(1)).toBe("Block C");
    expect(getBlockContent(2)).toBe("Block B");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("B");
  });

  it("move the last block down", async () => {
    // Cursor already at Block C
    await userEvent.keyboard(moveBlockKey("down"));

    expect(editor.getBlocks().length).toBe(3);
    expect(getBlockContent(0)).toBe("Block A");
    expect(getBlockContent(1)).toBe("Block B");
    expect(getBlockContent(2)).toBe("Block C");
    const content = editor.getContent();
    const pos = editor.getCursorPosition();
    expect(content.slice(pos - 1, pos)).toBe("C");
  });
});
