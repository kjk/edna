import { afterEach, describe, expect, it } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { cutCommand } from "../../src/editor/copy-paste";
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
});
