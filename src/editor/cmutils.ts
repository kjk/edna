import { foldedRanges } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
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

export function hasSelection(state: EditorState): boolean {
  return state.selection.ranges.some((range) => !range.empty);
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
