import { EditorSelection, findClusterBreak } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getNoteBlockFromPos } from "./block";

export function transposeChars({ state, dispatch }: EditorView): boolean {
  if (state.readOnly) return false;
  const changes = state.changeByRange((range) => {
    const block = getNoteBlockFromPos(state, range.head);
    if (!range.empty || !block || range.head <= block.contentFrom) return { range };

    const text = state.sliceDoc(block.contentFrom, block.to);
    const at = range.head - block.contentFrom;
    const middle = at === text.length ? findClusterBreak(text, at, false) : at;
    if (middle <= 0) return { range };
    const from = findClusterBreak(text, middle, false);
    const to = findClusterBreak(text, middle, true);
    return {
      changes: {
        from: block.contentFrom + from,
        to: block.contentFrom + to,
        insert: text.slice(middle, to) + text.slice(from, middle),
      },
      range: EditorSelection.cursor(block.contentFrom + to),
    };
  });
  if (changes.changes.empty) return false;
  dispatch(state.update(changes, { userEvent: "move.character", scrollIntoView: true }));
  return true;
}
