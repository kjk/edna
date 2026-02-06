import { codeFolding, foldedRanges, foldEffect, foldGutter, foldState, unfoldEffect } from "@codemirror/language";
import { RangeSet, StateEffect } from "@codemirror/state";
import { BlockInfo, EditorView } from "@codemirror/view";
import {
  ADD_NEW_BLOCK,
  heynoteEvent,
  LANGUAGE_CHANGE,
  transactionsHasAnnotation,
  transactionsHasAnnotationsAny,
  transactionsHasHistoryEvent,
} from "./annotation";
import { delimiterRegexWithoutNewline, getBlocks, getNoteBlocksFromRangeSet } from "./block/block";
import { FOLD_LABEL_LENGTH } from "./constants";
import type { MultiBlockEditor } from "./editor";
import type { SimpleRange } from "./types";

// This extension fixes so that a folded region is automatically unfolded if any changes happen
// on either the start line or the end line of the folded region (even if the change is not within the folded region)
// except for if the change is an insertion of a new block, or if the change doesn't actually insert anything.
//
// The purpose is to prevent extra characters to be inserted into a line that is folded, without the region
// being unfolded.
const autoUnfoldOnEdit = () => {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) {
      return;
    }

    const { state, view } = update;
    const foldRanges = foldedRanges(state);

    if (!foldRanges || foldRanges.size === 0) {
      return;
    }

    // we don't want to unfold a block/range if the user adds a new block, or changes language of the block
    if (transactionsHasAnnotationsAny(update.transactions, [ADD_NEW_BLOCK, LANGUAGE_CHANGE])) {
      return;
    }
    // an undo/redo action should never be able to get characters into a folded line but if we don't have
    // this check an undo/redo of a block insertion before/after the region will unfold the folded block
    if (transactionsHasHistoryEvent(update.transactions)) {
      return;
    }

    // This fixes so that removing the previous block immediately after a folded block won't unfold the folded block
    // Since nothing was inserted, there is no risk of us putting extra characters into folded lines
    // Commented out, because it DOES NOT WORK, since it allows removing characters within the folded region, without unfolding it
    //if (update.changes.inserted.length === 0) {
    //    return
    //}

    const unfoldRanges: SimpleRange[] = [];

    update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      foldRanges.between(0, state.doc.length, (from, to) => {
        const lineFrom = state.doc.lineAt(from).from;
        const lineTo = state.doc.lineAt(to).to;

        //console.log("lineFrom:", lineFrom, "lineTo:", lineTo, "fromA:", fromA, "toA:", toA, "fromB:", fromB, "toB:", toB);

        if (
          fromB === toB &&
          fromB === lineFrom &&
          (state.doc.length === 0 || state.doc.lineAt(lineFrom - 1).text.match(delimiterRegexWithoutNewline))
        ) {
          // if the change is the beginning of the folded line, we'll check if a block separator is
          // immediately before the folded range (or beginning of document), and we if so, we don't unfold it
          return;
        }

        if (
          fromB === toB &&
          fromB === lineTo &&
          (state.doc.length === toB || state.doc.lineAt(toB + 1).text.match(delimiterRegexWithoutNewline))
        ) {
          // If the change is at the end of the folded line, we'll check what comes after the folded range,
          // and if it's a new block, or the end of the document, we don't unfold it
          return;
        }

        if ((fromB >= lineFrom && fromB <= lineTo) || (toB >= lineFrom && toB <= lineTo)) {
          unfoldRanges.push({ from, to });
        }
      });
    });

    //console.log("Unfold ranges:", unfoldRanges);
    if (unfoldRanges.length > 0) {
      view.dispatch({
        effects: unfoldRanges.map((range) => unfoldEffect.of(range)),
      });
    }
  });
};

export function foldGutterExtension() {
  return [
    foldGutter({
      domEventHandlers: {
        click(view: EditorView, line: BlockInfo, event: Event) {
          // editor should not loose focus when clicking on the fold gutter
          view.contentDOM.focus();
          return false;
        },
      },
    }),
    codeFolding({
      //placeholderText: "⯈ Folded",
      preparePlaceholder: (state, { from, to }) => {
        // Count the number of lines in the folded range
        const firstLine = state.doc.lineAt(from);
        const lineFrom = firstLine.number;
        const lineTo = state.doc.lineAt(to).number;
        const lineCount = lineTo - lineFrom + 1;

        const label = firstLine.text;
        //console.log("label", label, "line", firstLine)
        const labelDom = document.createElement("span");
        labelDom.textContent = label.slice(0, 100);

        const linesDom = document.createElement("span");
        linesDom.textContent = `${label.slice(-1).trim() === "" ? "" : " "}… (${lineCount} lines)`;
        linesDom.style.fontStyle = "italic";

        const dom = document.createElement("span");
        dom.className = "cm-foldPlaceholder";
        dom.style.opacity = "0.6";
        if (firstLine.from === from) {
          dom.appendChild(labelDom);
        }
        dom.appendChild(linesDom);
        return dom;
      },
      placeholderDOM: (view, onClick, prepared) => {
        prepared.addEventListener("click", onClick);
        return prepared;
      },
    }),
    autoUnfoldOnEdit(),
  ];
}

export const toggleBlockFold = (editor: MultiBlockEditor) => (view: EditorView) => {
  const state = view.state;
  const folds = foldedRanges(state);

  const foldEffects: StateEffect<SimpleRange>[] = [];
  const unfoldEffects: StateEffect<SimpleRange>[] = [];
  let numFolded = 0,
    numUnfolded = 0;

  for (const block of getNoteBlocksFromRangeSet(state, state.selection.ranges)) {
    const firstLine = state.doc.lineAt(block.contentFrom);
    let blockIsFolded = false;
    const blockFolds: SimpleRange[] = [];
    folds.between(block.contentFrom, block.to, (from, to) => {
      if (from <= firstLine.to && to === block.to) {
        blockIsFolded = true;
        blockFolds.push({ from, to });
      }
    });
    if (blockIsFolded) {
      unfoldEffects.push(...blockFolds.map((range) => unfoldEffect.of(range)));
      numFolded++;
    } else {
      const lastLine = state.doc.lineAt(block.to);
      // skip single-line blocks, since they are not folded
      if (firstLine.from != lastLine.from) {
        const range = {
          from: Math.min(firstLine.to, block.contentFrom + FOLD_LABEL_LENGTH),
          to: block.to,
        };
        if (range.to > range.from) {
          foldEffects.push(foldEffect.of(range));
        }
        numUnfolded++;
      }
    }
  }

  if (foldEffects.length > 0 || unfoldEffects.length > 0) {
    // if multiple blocks are selected, instead of flipping the fold state of all blocks,
    // we'll fold all blocks if more blocks are unfolded than folded, and unfold all blocks otherwise
    view.dispatch({
      effects: [...(numUnfolded >= numFolded ? foldEffects : unfoldEffects)],
    });
  }
};

export const foldBlock = (editor: MultiBlockEditor) => (view: EditorView) => {
  const state = view.state;
  const blockRanges: SimpleRange[] = [];

  for (const block of getNoteBlocksFromRangeSet(state, state.selection.ranges)) {
    const line = state.doc.lineAt(block.contentFrom);
    // fold the block content, but only the first line
    const from = Math.min(line.to, block.contentFrom + FOLD_LABEL_LENGTH);
    const to = block.to;
    if (from < to) {
      // skip empty ranges
      blockRanges.push({ from, to });
    }
  }
  if (blockRanges.length > 0) {
    view.dispatch({
      effects: blockRanges.map((range) => foldEffect.of(range)),
    });
  }
};

export const unfoldBlock = (editor: MultiBlockEditor) => (view: EditorView) => {
  const state = view.state;
  const folds = foldedRanges(state);
  const blockFolds: SimpleRange[] = [];

  for (const block of getNoteBlocksFromRangeSet(state, state.selection.ranges)) {
    const firstLine = state.doc.lineAt(block.contentFrom);
    folds.between(block.contentFrom, block.to, (from, to) => {
      if (from <= firstLine.to && to === block.to) {
        blockFolds.push({ from, to });
      }
    });
  }

  if (blockFolds.length > 0) {
    view.dispatch({
      effects: blockFolds.map((range) => unfoldEffect.of(range)),
    });
  }
};

export const foldAllBlocks = (editor: MultiBlockEditor) => (view: EditorView) => {
  const state = view.state;
  const blockRanges = [];

  for (const block of getBlocks(state)) {
    const line = state.doc.lineAt(block.contentFrom);
    // fold the block content, but only the first line
    const from = Math.min(line.to, block.contentFrom + FOLD_LABEL_LENGTH);
    const to = block.to;
    if (from < to) {
      // skip empty ranges
      blockRanges.push({ from, to });
    }
  }
  if (blockRanges.length > 0) {
    view.dispatch({
      effects: blockRanges.map((range) => foldEffect.of(range)),
    });
  }
};

export const unfoldAlBlocks = (editor: MultiBlockEditor) => (view: EditorView) => {
  const state = view.state;
  const folds = state.field(foldState, false) || RangeSet.empty;
  const blockFolds: SimpleRange[] = [];

  for (const block of getBlocks(state)) {
    const firstLine = state.doc.lineAt(block.contentFrom);
    folds.between(block.contentFrom, block.to, (from: number, to: number) => {
      if (from <= firstLine.to && to === block.to) {
        blockFolds.push({ from, to });
      }
    });
  }

  if (blockFolds.length > 0) {
    view.dispatch({
      effects: blockFolds.map((range) => unfoldEffect.of(range)),
    });
  }
};

// unlike unfoldAll() from @codemirror/language, this will unfold all folded regions
// not just those related to code folding
// this is emergency command, if folding gets screwed up
export const unfoldEverything = (editor: MultiBlockEditor) => (view: EditorView) => {
  const state = view.state;
  const foldRanges = state.field(foldState, false);
  // console.log("unfoldEverything: foldRanges:", foldRanges);
  if (!foldRanges) {
    // console.log("unfoldEverything: no foldRanges found");
    return;
  }
  let effects: StateEffect<SimpleRange>[] = [];
  foldRanges.between(0, state.doc.length, (from: number, to: number) => {
    let effect = unfoldEffect.of({ from, to });
    effects.push(effect);
  });
  // console.log("unfoldEverything: effects:", effects);
  view.dispatch({
    effects: effects,
  });
};
