import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Scroll margin", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  function topMargin(): number {
    const view = te!.editor.view;
    let top = 0;
    for (const provider of view.state.facet(EditorView.scrollMargins)) {
      top += provider(view).top ?? 0;
    }
    return top;
  }

  it("top margin is reduced in the first lines of the last block", () => {
    const lines = ["Line 1", "Line 2", "Line 3", "Line 4", "Line 5", "Line 6", "Line 7"];
    te = createEditor("\n∞∞∞text\nFirst block line 1\nFirst block line 2\n∞∞∞text\n" + lines.join("\n"));
    const { editor } = te;
    const lineHeight = editor.view.defaultLineHeight;
    const [first, last] = editor.getBlocks();
    const lineStart = (n: number) => last!.contentFrom + lines.slice(0, n - 1).join("\n").length + (n > 1 ? 1 : 0);

    editor.setCursorPosition(first!.contentFrom);
    expect(topMargin()).toBe(lineHeight * 5);

    editor.setCursorPosition(lineStart(1));
    expect(topMargin()).toBe(0);

    editor.setCursorPosition(lineStart(3));
    expect(topMargin()).toBe(lineHeight * 2);

    editor.setCursorPosition(lineStart(7));
    expect(topMargin()).toBe(lineHeight * 5);
  });

  it("Mod-Shift-Enter adds a block at the end and scrolls down", async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    te = createEditor("\n∞∞∞text\n" + lines.join("\n"));
    const { editor } = te;
    editor.view.dom.style.height = "200px";
    editor.setCursorPosition(editor.getBlocks()[0]!.contentFrom);
    editor.view.scrollDOM.scrollTop = 0;
    const modKey = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}{Shift>}{Enter}{/Shift}{/${modKey}}`);
    expect(editor.getBlocks().length).toBe(2);
    await expect.poll(() => editor.view.scrollDOM.scrollTop).toBeGreaterThan(500);
  });
});
