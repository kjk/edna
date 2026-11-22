import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { cutCommand, removeDelimitersFromPastedText } from "../../src/editor/copy-paste";
import { cleanup, createEditor, getBlockContent, type TestEditor } from "./utils";

describe("Cut", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  it("cut with empty selection removes the current line", () => {
    te = createEditor("\n∞∞∞text\nline 1\nline 2\nline 3");
    const view = te.editor.view;
    const pos = view.state.doc.toString().indexOf("line 2") + 2;
    view.dispatch({ selection: EditorSelection.cursor(pos) });

    cutCommand(te.editor)(view);

    expect(getBlockContent(te.editor, 0)).toBe("line 1\nline 3");
  });

  it("cut with selection removes only the selection", () => {
    te = createEditor("\n∞∞∞text\nline 1\nline 2");
    const view = te.editor.view;
    const from = view.state.doc.toString().indexOf("line 2");
    view.dispatch({ selection: EditorSelection.range(from, from + 4) });

    cutCommand(te.editor)(view);

    expect(getBlockContent(te.editor, 0)).toBe("line 1\n 2");
  });

  // cutting the last line of a block keeps the next block's delimiter intact (U10)
  for (let [doc, at, want] of [
    ["\n∞∞∞text\nonly\n∞∞∞markdown\nx", "only", ["", "x"]],
    ["\n∞∞∞text\na\nlast\n∞∞∞markdown\nx", "last", ["a", "x"]],
    ["\n∞∞∞text\n\n∞∞∞markdown\nx", "", ["", "x"]],
  ] as [string, string, string[]][]) {
    it(`cut line '${at}' before a delimiter doesn't merge blocks`, () => {
      te = createEditor(doc);
      const view = te.editor.view;
      const pos = at ? doc.indexOf(at) : doc.indexOf("\n\n") + 1;
      view.dispatch({ selection: EditorSelection.cursor(pos) });
      cutCommand(te.editor)(view);
      expect(te.editor.getBlocks().length).toBe(2);
      expect(getBlockContent(te.editor, 0)).toBe(want[0]);
      expect(getBlockContent(te.editor, 1)).toBe(want[1]);
    });
  }

  // pasted text doesn't create blocks (U27)
  it("removeDelimitersFromPastedText", () => {
    expect(removeDelimitersFromPastedText("a\n∞∞∞js\nb")).toBe("a\n\nb");
    expect(removeDelimitersFromPastedText("∞∞∞text-a\nb")).toBe("\nb");
    expect(removeDelimitersFromPastedText("a\n∞∞∞Text\nb")).toBe("a\n∞∞∞Text\nb");
    expect(removeDelimitersFromPastedText("plain")).toBe("plain");
  });

  it("pasting a note's raw text doesn't add blocks", () => {
    te = createEditor("\n∞∞∞text\nhello\n");
    const view = te.editor.view;
    view.dispatch({ selection: EditorSelection.cursor(view.state.doc.length) });
    const dt = new DataTransfer();
    dt.setData("text/plain", "\n∞∞∞js\nlet x\n∞∞∞markdown\n# hi");
    view.contentDOM.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toContain("let x");
    expect(te.editor.getBlocks().length).toBe(1);
  });

  it("removeDelimitersFromPastedText: first / last line only if pasted at a line start / end", () => {
    expect(removeDelimitersFromPastedText("∞∞∞js", false, false)).toBe("∞∞∞js");
    expect(removeDelimitersFromPastedText("∞∞∞js", true, false)).toBe("∞∞∞js");
    expect(removeDelimitersFromPastedText("∞∞∞js", true, true)).toBe("");
    expect(removeDelimitersFromPastedText("∞∞∞js\na\n∞∞∞md\nb\n∞∞∞py", false, false)).toBe("∞∞∞js\na\n\nb\n∞∞∞py");
  });

  it("pasting a delimiter-like word in the middle of a line keeps it", () => {
    te = createEditor("\n∞∞∞text\nab\n");
    const view = te.editor.view;
    const pos = view.state.doc.toString().indexOf("ab") + 1;
    view.dispatch({ selection: EditorSelection.cursor(pos) });
    const dt = new DataTransfer();
    dt.setData("text/plain", "∞∞∞markdown");
    view.contentDOM.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    expect(getBlockContent(te.editor, 0)).toBe("a∞∞∞markdownb\n");
  });
});
