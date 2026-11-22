import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { getNoteBlockFromPos } from "./block/block";

export const markdownSelectionWrapping = Prec.high(
  EditorView.inputHandler.of((view, from, to, text) => {
    const { state } = view;
    const { main, ranges } = state.selection;
    if (
      state.readOnly ||
      view.compositionStarted ||
      from !== main.from ||
      to !== main.to ||
      !/^[*_\x60~]$/.test(text)
    ) {
      return false;
    }
    const shouldWrap = (start: number, end: number) => {
      const block = getNoteBlockFromPos(state, start);
      return start !== end && block?.language === "markdown" && start >= block.contentFrom && end <= block.to;
    };
    if (!ranges.some((range) => shouldWrap(range.from, range.to))) {
      return false;
    }
    const changes = state.changeByRange((range) => {
      if (shouldWrap(range.from, range.to)) {
        return {
          changes: [
            { from: range.from, insert: text },
            { from: range.to, insert: text },
          ],
          range: EditorSelection.range(range.anchor + 1, range.head + 1),
        };
      }
      return {
        changes: { from: range.from, to: range.to, insert: text },
        range: EditorSelection.cursor(range.from + text.length),
      };
    });
    view.dispatch(changes, { scrollIntoView: true, userEvent: "input.type" });
    return true;
  }),
);

export function createDynamicCloseBracketsExtension(): Extension {
  return [closeBrackets(), Prec.high(keymap.of(closeBracketsKeymap))];
}
