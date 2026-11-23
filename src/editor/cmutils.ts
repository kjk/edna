import { foldedRanges } from "@codemirror/language";
import { EditorSelection, type EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SimpleRange } from "./types";

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function isWindows(): boolean {
  return typeof navigator !== "undefined" && /Win/.test(navigator.platform);
}

export function isReadOnly(view: EditorView): boolean {
  return view.state.readOnly;
}

export function getCurrentSelection(state: EditorState): SimpleRange & { selectedText: string } {
  const { from, to } = state.selection.main;
  return { from, to, selectedText: state.sliceDoc(from, to) };
}

// true if any selection range (or, with mainOnly, the main one) is not empty
export function hasSelection(state: EditorState, mainOnly = false): boolean {
  if (mainOnly) {
    return !state.selection.main.empty;
  }
  return state.selection.ranges.some((range) => !range.empty);
}

// collapse every selection range to a cursor at its head
export function collapseSelectionToHeads(view: EditorView): void {
  const { ranges, mainIndex } = view.state.selection;
  view.dispatch({
    selection: EditorSelection.create(
      ranges.map((range) => EditorSelection.cursor(range.head)),
      mainIndex,
    ),
    userEvent: "select",
  });
}

export function focusEditorView(view: EditorView): void {
  view.focus();
}

export function getFoldedRanges(view: EditorView): SimpleRange[] {
  const ranges: SimpleRange[] = [];
  const iter = foldedRanges(view.state).iter();
  for (; iter.value; iter.next()) {
    ranges.push({ from: iter.from, to: iter.to });
  }
  return ranges;
}
