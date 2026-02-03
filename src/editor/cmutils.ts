// codemirror utilities

import { foldState } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export function isReadOnly(view: EditorView): boolean {
  return view.state.readOnly;
}

export function getCurrentSelection(state: EditorState): { from: number; to: number; selectedText: string } {
  const { from, to } = state.selection.main;
  const selectedText = state.doc.sliceString(from, to);
  return { from, to, selectedText };
}

export function hasSelection(state: EditorState): boolean {
  const { from, to } = state.selection.main;
  return from != to;
}

export function focusEditorView(view: EditorView) {
  if (!view || view.hasFocus) {
    // console.log("focusEditorView: no editorView or already has focus")
    return;
  }
  let max = 10; // limit to 1 sec
  const timer = setInterval(() => {
    view.focus();
    max -= 1;
    if (view.hasFocus || max < 0) {
      // if (max < 0) {
      //   console.log("focusEditorView: failed to focus")
      // }
      // if (editorView.hasFocus) {
      //   console.log("focusEditorView: focused")
      // }
      clearInterval(timer);
    }
  }, 100);
}

export function getFoldedRanges(view: EditorView) {
  const foldedRanges = [];
  let state = view.state;
  state.field(foldState, false)?.between(0, state.doc.length, (from, to) => {
    foldedRanges.push({ from, to });
  });
  return foldedRanges;
}
