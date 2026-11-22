import { indentMore } from "@codemirror/commands";
import { indentService, indentUnit } from "@codemirror/language";
import { countColumn, EditorSelection, EditorState, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getNoteBlockFromPos } from "./block/block";
import { hasSelection } from "./cmutils";
import { getLanguage } from "./languages";

export function indentationExtension(useTabs: boolean, tabSize: number): Extension[] {
  const width = Number.isInteger(tabSize) && tabSize > 0 ? tabSize : 4;
  return [
    EditorState.tabSize.of(width),
    indentUnit.of(useTabs ? "\t" : " ".repeat(width)),
    indentService.of((context, pos) => {
      const block = getNoteBlockFromPos(context.state, pos);
      if (block && getLanguage(block.language)?.inheritIndentation) {
        return context.lineIndent(pos, -1);
      }
      return undefined;
    }),
  ];
}

export function insertIndentation(view: EditorView): boolean {
  const { state } = view;
  if (state.readOnly) {
    return false;
  }
  if (hasSelection(state)) {
    return indentMore(view);
  }
  const tabs = state.facet(indentUnit) === "\t";
  const changes = state.changeByRange((range) => {
    const block = getNoteBlockFromPos(state, range.from);
    const from = Math.max(range.from, block?.contentFrom ?? 0);
    const line = state.doc.lineAt(from);
    const column = countColumn(state.sliceDoc(line.from, from), state.tabSize);
    const insert = tabs ? "\t" : " ".repeat(state.tabSize - (column % state.tabSize));
    return { changes: { from, insert }, range: EditorSelection.cursor(from + insert.length) };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input.indent" });
  return true;
}
