import { afterEach, expect, it } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { formatBlockContent } from "../../src/format-code";
import { cleanup, getBlockContent, createEditor, type TestEditor } from "./utils";

let te: TestEditor | undefined;
afterEach(() => {
  cleanup(te);
  te = undefined;
});

it("formats a block", async () => {
  te = createEditor("\n∞∞∞javascript\nlet   x=1");
  te.editor.view.dispatch({ selection: EditorSelection.cursor(te.editor.view.state.doc.length) });
  expect(await formatBlockContent(te.editor)).toBe(true);
  expect(getBlockContent(te.editor, 0)).toBe("let x = 1;\n");
});

// the formatter is async: offsets read before it ran are stale (U11)
it("doesn't apply the result if the document changed while formatting", async () => {
  te = createEditor("\n∞∞∞javascript\nlet   x=1");
  const view = te.editor.view;
  view.dispatch({ selection: EditorSelection.cursor(view.state.doc.length) });
  const p = formatBlockContent(te.editor);
  view.dispatch({ changes: { from: view.state.doc.length, insert: "\nlet y" } });
  expect(await p).toBe(false);
  expect(getBlockContent(te.editor, 0)).toBe("let   x=1\nlet y");
});
