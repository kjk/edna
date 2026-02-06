import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import {
  cursorDocStart,
  cursorDocEnd,
  selectDocStart,
  selectDocEnd,
} from "@codemirror/commands";
import { MultiBlockEditor } from "../../src/editor/editor";

describe("Cursor document navigation (browser tests)", () => {
  let editor: MultiBlockEditor;
  let container: HTMLDivElement;

  const threeBlockContent = [
    "\n\u221E\u221E\u221Etext",
    "\nFirst block content",
    "\n\u221E\u221E\u221Ejavascript",
    '\nconsole.log("second block")',
    "\n\u221E\u221E\u221Emarkdown",
    "\n# Third block",
    "\nSome markdown content\n",
  ].join("");

  function createEditor(content: string) {
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

    editor.setContent(content);
    editor.view.focus();
  }

  function getSelectedText(): string {
    const state = editor.view.state;
    const sel = state.selection.main;
    return state.doc.sliceString(sel.from, sel.to);
  }

  afterEach(() => {
    if (container) {
      container.remove();
    }
  });

  it("cursorDocStart moves to beginning of document", async () => {
    createEditor(threeBlockContent);

    // Move cursor to the end of the document
    cursorDocEnd(editor.view);

    // Move cursor to the beginning of the document
    cursorDocStart(editor.view);

    // Verify cursor is at the beginning of the first block's content
    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].content.from);
  });

  it("cursorDocEnd moves to end of document", async () => {
    createEditor(threeBlockContent);

    // Move cursor to the beginning of the document
    cursorDocStart(editor.view);

    // Move cursor to the end of the document
    cursorDocEnd(editor.view);

    // Verify cursor is at the end
    expect(editor.getCursorPosition()).toBe(editor.getContent().length);
  });

  it("selectDocStart selects from cursor to beginning of document", async () => {
    createEditor(threeBlockContent);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Position cursor in the middle of the document (in the second block)
    const blocks = editor.getBlocks();
    const secondBlockContent = blocks[1].content;
    const midPos = Math.floor((secondBlockContent.from + secondBlockContent.to) / 2);
    editor.setCursorPosition(midPos);

    // Select from cursor to beginning of document
    selectDocStart(editor.view);

    // Should select text from cursor position back to beginning
    const selectedText = getSelectedText();
    expect(selectedText.length).toBeGreaterThan(0);
    expect(selectedText).toContain("First block content");
  });

  it("selectDocEnd selects from cursor to end of document", async () => {
    createEditor(threeBlockContent);

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
    createEditor(
      "\n\u221E\u221E\u221Etext\n\n\u221E\u221E\u221Ejavascript\n\n\u221E\u221E\u221Emarkdown\n",
    );

    // Test moving to beginning
    cursorDocEnd(editor.view);
    cursorDocStart(editor.view);

    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].content.from);

    // Test moving to end
    cursorDocEnd(editor.view);
    expect(editor.getCursorPosition()).toBe(editor.getContent().length);
  });

  it("cursor navigation works in single block", async () => {
    createEditor("\n\u221E\u221E\u221Etext\nSingle block with some content\n");

    // Move to middle of block
    cursorDocStart(editor.view);
    for (let i = 0; i < 10; i++) {
      await userEvent.keyboard("{ArrowRight}");
    }

    // Test Home
    cursorDocStart(editor.view);
    const blocks = editor.getBlocks();
    expect(editor.getCursorPosition()).toBe(blocks[0].content.from);

    // Test End
    cursorDocEnd(editor.view);
    expect(editor.getCursorPosition()).toBe(editor.getContent().length);
  });
});
