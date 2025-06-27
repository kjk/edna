// codemirror utilities

import { foldState } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * @param {EditorView} view
 * @returns {boolean}
 */
export function isReadOnly(view) {
  return view.state.readOnly;
}

/**
 * @param {EditorState} state
 * @returns {{from: number, to: number, selectedText: string}}
 */
export function getCurrentSelection(state) {
  const { from, to } = state.selection.main;
  const selectedText = state.doc.sliceString(from, to);
  return { from, to, selectedText };
}

/**
 * @param {EditorState} state
 * @returns {boolean}
 */
export function hasSelection(state) {
  const { from, to } = state.selection.main;
  return from != to;
}

/**
 * try real hard to put focus in EditorView
 * @param {EditorView} view
 */
export function focusEditorView(view) {
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

export function getFoldedRanges(view) {
  const foldedRanges = [];
  let state = view.state;
  state.field(foldState, false)?.between(0, state.doc.length, (from, to) => {
    foldedRanges.push({ from, to });
  });
  return foldedRanges;
}
