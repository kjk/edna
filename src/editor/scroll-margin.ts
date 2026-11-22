import { EditorView } from "@codemirror/view";
import { getLastNoteBlock } from "./block/block";

export function scrollMargin() {
  return [
    EditorView.scrollMargins.of((view) => {
      const { state, defaultLineHeight } = view;
      const last = getLastNoteBlock(state);
      const head = state.selection.main.head;
      const linesFromStart =
        last && head >= last.contentFrom
          ? state.doc.lineAt(head).number - state.doc.lineAt(last.contentFrom).number
          : 5;
      return { top: Math.min(5, linesFromStart) * defaultLineHeight, bottom: 5 * defaultLineHeight };
    }),
  ];
}
