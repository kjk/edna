import { afterEach, expect, it } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { foldedRanges } from "@codemirror/language";
import { cleanup, createEditor, getBlockContent, type TestEditor } from "./utils";

let te: TestEditor | undefined;
afterEach(() => {
  cleanup(te);
  te = undefined;
});

const doc = "\n∞∞∞text\nline 1\nline 2\n∞∞∞markdown\nm1\nm2\nm3";

// folds are stored as offsets and restored after the note might have changed (U13)
it("restoring folds ignores ranges that don't fit the document", () => {
  te = createEditor(doc);
  const blocks = te.editor.getBlocks();
  const valid = { from: blocks[1].contentFrom + 2, to: blocks[1].to };
  te.editor.setFoldedRanges([{ from: 0, to: 5 }, { from: 10, to: 10000 }, { from: blocks[0].to - 2, to: blocks[1].contentFrom + 1 }, valid]);
  const folds: { from: number; to: number }[] = [];
  foldedRanges(te.editor.view.state).between(0, doc.length, (from, to) => {
    folds.push({ from, to });
  });
  expect(folds).toEqual([valid]);
});

// atomic ranges only constrain cursor motion (U16)
it("a selection set inside a delimiter is moved to the block's content", () => {
  te = createEditor(doc);
  const view = te.editor.view;
  const blocks = te.editor.getBlocks();
  // inside "∞∞∞markdown", e.g. a find match for "markdown"
  view.dispatch({ selection: EditorSelection.range(blocks[1].from + 4, blocks[1].from + 12) });
  expect(view.state.selection.main.from).toBe(blocks[1].contentFrom);
  view.dispatch(view.state.replaceSelection("x"));
  expect(te.editor.getBlocks()[1].language).toBe("markdown");
  expect(getBlockContent(te.editor, 1).startsWith("x")).toBe(true);

  // end of the previous block is a valid position
  view.dispatch({ selection: EditorSelection.cursor(blocks[1].from) });
  expect(view.state.selection.main.head).toBe(blocks[1].from);
  // so is a selection spanning blocks
  view.dispatch({ selection: EditorSelection.range(3, view.state.doc.length) });
  expect(view.state.selection.main.from).toBe(blocks[0].contentFrom);
  expect(view.state.selection.main.to).toBe(view.state.doc.length);
});
