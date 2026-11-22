import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { getActiveNoteBlock, getBlockLineFromPos, getLastNoteBlock } from "./block/block";

// Port of Heynote's scroll-margin.js

// keep this many lines visible above / below the cursor when scrolling
const kNumLinesMargin = 5;

/**
 * Scroll margins with a dynamic top margin: in the first lines of the last
 * block the top margin is reduced so that the last block can be scrolled to
 * the top of the viewport (with nothing above it visible) and stay there while
 * editing.
 */
export function scrollMargin() {
  const marginCompartment = new Compartment();
  let lineHeight = 16;

  const marginSize = (lines: number) => lineHeight * lines;
  const margins = (top: number) => EditorView.scrollMargins.of(() => ({ top, bottom: marginSize(kNumLinesMargin) }));

  let currentTopMargin = marginSize(kNumLinesMargin);

  const dynamicScrollMargins = EditorState.transactionExtender.of((tr) => {
    if (!tr.selection) {
      return null;
    }
    const state = tr.state;
    const lineNum = getBlockLineFromPos(state, state.selection.main.head)?.line;
    if (!lineNum) {
      return null;
    }
    let topMargin = marginSize(kNumLinesMargin);
    if (getActiveNoteBlock(state)?.from === getLastNoteBlock(state)?.from && lineNum <= kNumLinesMargin) {
      // in the first lines of the last block: only lines above the cursor
      topMargin = marginSize(lineNum - 1);
    }
    if (topMargin === currentTopMargin) {
      return null;
    }
    currentTopMargin = topMargin;
    return { effects: marginCompartment.reconfigure(margins(topMargin)) };
  });

  const lineHeightTracker = ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        lineHeight = view.defaultLineHeight;
      }
      update(update: ViewUpdate) {
        if (update.geometryChanged) {
          lineHeight = update.view.defaultLineHeight;
        }
      }
    },
  );

  return [dynamicScrollMargins, lineHeightTracker, marginCompartment.of(margins(marginSize(kNumLinesMargin)))];
}
