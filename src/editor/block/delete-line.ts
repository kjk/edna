import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getNoteBlockFromPos } from "./block";
import { selectedLines } from "./selected-lines";

export function deleteLine(view: EditorView): boolean {
  const { state } = view;
  if (state.readOnly) return false;

  const changes = state.changes(selectedLines(state).map(({ block, first, last }) => ({
    from: Math.max(block.contentFrom, state.doc.line(first).from - 1),
    to: state.doc.line(last).to,
  })));
  if (changes.empty) return false;

  const ranges = state.selection.ranges.map((range) => {
    const block = getNoteBlockFromPos(state, range.head);
    if (!block) return range;
    const line = state.doc.lineAt(Math.max(block.contentFrom, range.head));
    const nextLine = line.to < block.to ? state.doc.line(line.number + 1) : line;
    return EditorSelection.cursor(nextLine.from + Math.min(nextLine.length, Math.max(0, range.head - line.from)));
  });
  view.dispatch({
    changes,
    selection: EditorSelection.create(ranges, state.selection.mainIndex).map(changes),
    scrollIntoView: true,
    userEvent: "delete.line",
  });
  return true;
}
