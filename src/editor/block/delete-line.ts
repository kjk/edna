import { EditorSelection, EditorState, SelectionRange } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { LineBlock } from "../types";
import { getActiveNoteBlock } from "./block";

function updateSel(sel: EditorSelection, by: (range: SelectionRange) => SelectionRange): EditorSelection {
  return EditorSelection.create(sel.ranges.map(by), sel.mainIndex);
}

function selectedLineBlocks(state: EditorState): LineBlock[] {
  let blocks: LineBlock[] = [],
    upto = -1;
  for (let range of state.selection.ranges) {
    let startLine = state.doc.lineAt(range.from),
      endLine = state.doc.lineAt(range.to);
    if (!range.empty && range.to == endLine.from) endLine = state.doc.lineAt(range.to - 1);
    if (upto >= startLine.number && blocks.length > 0) {
      let prev = blocks[blocks.length - 1]!;
      prev.to = endLine.to;
      prev.ranges.push(range);
    } else {
      blocks.push({ from: startLine.from, to: endLine.to, ranges: [range] });
    }
    upto = endLine.number + 1;
  }
  return blocks;
}

export const deleteLine = (view: EditorView) => {
  if (view.state.readOnly) return false;

  // console.log("deleteLine: started");
  const { state } = view;

  const block = getActiveNoteBlock(view.state);
  if (!block) return false;
  const selectedLines = selectedLineBlocks(state);

  const changes = state.changes(
    selectedLines.map(({ from, to }) => {
      if (from !== block.contentFrom || to !== block.to) {
        if (from > 0) from--;
        else if (to < state.doc.length) to++;
      }
      return { from, to };
    }),
  );

  const selection = updateSel(state.selection, (range) => view.moveVertically(range, true)).map(changes);
  view.dispatch({
    changes,
    selection,
    scrollIntoView: true,
    userEvent: "delete.line",
  });

  return true;
};
