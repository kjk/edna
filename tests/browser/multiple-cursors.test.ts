import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { EditorSelection } from "@codemirror/state";
import { MultiBlockEditor } from "../../src/editor/editor";
import { newCursorBelow } from "../../src/editor/block/commands";

describe("Multiple cursors (browser tests)", () => {
  let editor: MultiBlockEditor;
  let container: HTMLDivElement;

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

  afterEach(() => {
    if (container) container.remove();
  });

  function getCursorCount(): number {
    return editor.view.state.selection.ranges.length;
  }

  it("newCursorBelow creates additional cursors", async () => {
    createEditor(
      "\n\u221E\u221E\u221Etext\nFirst line of content\nSecond line of content\nThird line of content\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Position cursor at first content line
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom);

    expect(getCursorCount()).toBe(1);

    // Add cursor below using command directly
    newCursorBelow(editor.view);
    expect(getCursorCount()).toBe(2);

    newCursorBelow(editor.view);
    expect(getCursorCount()).toBe(3);
  });

  it("programmatic multiple cursors via dispatch", async () => {
    createEditor(
      "\n\u221E\u221E\u221Etext\nFirst line\nSecond line\nThird line\nFourth line\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find content lines (skip the delimiter line)
    const blocks = editor.getBlocks();
    const contentFrom = blocks[0].contentFrom;
    const doc = editor.view.state.doc;
    const contentLine = doc.lineAt(contentFrom);

    const positions: number[] = [];
    for (let i = 0; i < 4; i++) {
      positions.push(doc.line(contentLine.number + i).from);
    }

    editor.view.dispatch({
      selection: EditorSelection.create(
        positions.map((pos) => EditorSelection.cursor(pos)),
        0,
      ),
    });

    expect(getCursorCount()).toBe(4);
  });

  it("multiple cursors typing behavior", async () => {
    createEditor("\n\u221E\u221E\u221Etext\nLine 1\nLine 2\nLine 3\n");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Find the content lines using block boundaries
    const blocks = editor.getBlocks();
    const doc = editor.view.state.doc;
    const firstContentLine = doc.lineAt(blocks[0].contentFrom);

    const line1 = doc.line(firstContentLine.number);     // "Line 1"
    const line2 = doc.line(firstContentLine.number + 1);  // "Line 2"
    const line3 = doc.line(firstContentLine.number + 2);  // "Line 3"

    editor.view.dispatch({
      selection: EditorSelection.create(
        [EditorSelection.cursor(line1.to), EditorSelection.cursor(line2.to), EditorSelection.cursor(line3.to)],
        0,
      ),
    });

    expect(getCursorCount()).toBe(3);

    // Type some text at all cursor positions
    await userEvent.keyboard(">> ");

    // Check that text was added at all cursor positions
    const content = editor.getContent();
    expect(content).toContain("Line 1>> ");
    expect(content).toContain("Line 2>> ");
    expect(content).toContain("Line 3>> ");
  });

  it("Alt+Click creates additional cursor via mouse event", async () => {
    createEditor(
      "\n\u221E\u221E\u221Etext\nFirst line of content\nSecond line of content\nThird line of content\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Click on first line to position cursor
    const lines = container.querySelectorAll(".cm-line");
    expect(lines.length).toBeGreaterThanOrEqual(3);

    (lines[0] as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Alt+Click on second line to add cursor using MouseEvent
    const rect = (lines[1] as HTMLElement).getBoundingClientRect();
    const altClick = new MouseEvent("mousedown", {
      altKey: true,
      bubbles: true,
      clientX: rect.left + 5,
      clientY: rect.top + 5,
    });
    (lines[1] as HTMLElement).dispatchEvent(altClick);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(getCursorCount()).toBe(2);
  });

  // Note: Heynote's "Alt+Click removes existing cursor" and "Alt+Click works with text selection"
  // tests rely on precise mouse interaction that's hard to replicate in vitest browser mode.
  // The command-based and programmatic tests above cover the core multiple-cursor functionality.
});
