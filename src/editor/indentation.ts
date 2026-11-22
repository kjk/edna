import { indentMore } from "@codemirror/commands";
import { indentService, indentUnit } from "@codemirror/language";
import { countColumn, EditorSelection, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getNoteBlockFromPos } from "./block/block";
import { getLanguage } from "./languages";

// For blocks in languages with inheritIndentation, returning null tells
// CodeMirror to use the indentation of the previous line on Enter.
// undefined means: ask the language
const inheritIndentationService = indentService.of((context, pos) => {
  const block = getNoteBlockFromPos(context.state, pos);
  if (block && getLanguage(block.language)?.inheritIndentation) {
    return null;
  }
  return undefined;
});

// indent unit (tab or spaces), tab width and indentation service
export function indentationExtension(useTabs: boolean, tabSize: number) {
  return [
    indentUnit.of(useTabs ? "\t" : " ".repeat(tabSize)),
    EditorState.tabSize.of(tabSize),
    inheritIndentationService,
  ];
}

/**
 * Tab key: if there's a selection, indent selected lines. Otherwise insert
 * indentation at the cursor, aligned to the next tab stop.
 */
export const insertIndentation = (view: EditorView): boolean => {
  const { state, dispatch } = view;
  if (state.readOnly) {
    return false;
  }
  if (state.selection.ranges.some((r) => !r.empty)) {
    return indentMore(view);
  }
  const unit = state.facet(indentUnit);
  if (unit === "\t") {
    dispatch(state.update(state.replaceSelection("\t"), { scrollIntoView: true, userEvent: "input" }));
    return true;
  }
  const size = unit.length;
  const changes = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head);
    // visual column, taking tabs into account
    const column = countColumn(line.text, state.tabSize, range.head - line.from);
    const n = size - (column % size);
    return {
      changes: { from: range.head, insert: " ".repeat(n) },
      range: EditorSelection.cursor(range.head + n),
    };
  });
  dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
  return true;
};
