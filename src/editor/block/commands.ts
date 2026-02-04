import { EditorSelection, EditorState, SelectionRange, Transaction } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  ADD_NEW_BLOCK,
  CURRENCIES_LOADED,
  DELETE_BLOCK,
  heynoteEvent,
  LANGUAGE_CHANGE,
  MOVE_BLOCK,
} from "../annotation";
import type { EdnaEditor } from "../editor";
import { type Block, blockState, getActiveNoteBlock, getFirstNoteBlock, getLastNoteBlock, getNoteBlockFromPos } from "./block";
import { moveLineDown, moveLineUp } from "./move-lines";
import { selectAll } from "./select-all";

export { moveLineDown, moveLineUp, selectAll };

export function getBlockDelimiter(defaultToken: string, autoDetect: boolean): string {
  return `\n∞∞∞${autoDetect ? defaultToken + "-a" : defaultToken}\n`;
}

export function insertNewBlockAtCursor({ state, dispatch }: EditorView) {
  if (state.readOnly) return false;

  const currentBlock = getActiveNoteBlock(state);
  let delimText;
  if (currentBlock) {
    delimText = `\n∞∞∞${currentBlock.language.name}${currentBlock.language.auto ? "-a" : ""}\n`;
  } else {
    delimText = "\n∞∞∞text-a\n";
  }
  dispatch(state.replaceSelection(delimText), {
    scrollIntoView: true,
    userEvent: "input",
  });

  return true;
}

export function addNewBlockBeforeCurrent({ state, dispatch }: EditorView): boolean {
  if (state.readOnly) return false;

  const block = getActiveNoteBlock(state);
  if (!block) return false;
  const delimText = "\n∞∞∞text-a\n";

  dispatch(
    state.update(
      {
        changes: {
          from: block.delimiter.from,
          insert: delimText,
        },
        selection: EditorSelection.cursor(block.delimiter.from + delimText.length),
        annotations: [heynoteEvent.of(ADD_NEW_BLOCK)],
      },
      {
        scrollIntoView: true,
        userEvent: "input",
      },
    ),
  );
  return true;
}

function isEmptyLineAtPosition(doc: { lineAt: (pos: number) => { text: string } }, pos: number): boolean {
  const line = doc.lineAt(pos);
  return line.text === "";
}

export function addNewBlockAfterCurrent({ state, dispatch }: EditorView): boolean {
  if (state.readOnly) return false;

  const block = getActiveNoteBlock(state);
  if (!block) return false;
  let delimText = "\n∞∞∞text-a\n";

  // if current block is not completely empty and cursor is at last
  // line of the block and that line is empty, delete the last line
  // in current block
  let isBlockEmpty = block.content.from === block.content.to;
  if (!isBlockEmpty) {
    const selection = state.selection;
    if (selection.ranges.length === 1) {
      const main = selection.main;
      if (main.empty && main.from == block.content.to) {
        if (isEmptyLineAtPosition(state.doc, main.from)) {
          delimText = "∞∞∞text-a\n";
        }
      }
    }
  }

  dispatch(
    state.update(
      {
        changes: {
          from: block.content.to,
          insert: delimText,
        },
        selection: EditorSelection.cursor(block.content.to + delimText.length),
      },
      {
        scrollIntoView: true,
        userEvent: "input",
      },
    ),
  );
  return true;
}

export function addNewBlockBeforeFirst({ state, dispatch }: EditorView): boolean {
  if (state.readOnly) return false;

  const block = getFirstNoteBlock(state);
  if (!block) return false;
  const delimText = "\n∞∞∞text-a\n";

  dispatch(
    state.update(
      {
        changes: {
          from: block.delimiter.from,
          insert: delimText,
        },
        selection: EditorSelection.cursor(delimText.length),
        annotations: [heynoteEvent.of(ADD_NEW_BLOCK)],
      },
      {
        scrollIntoView: true,
        userEvent: "input",
      },
    ),
  );
  return true;
}

export function addNewBlockAfterLast({ state, dispatch }: EditorView): boolean {
  if (state.readOnly) return false;
  const block = getLastNoteBlock(state);
  if (!block) return false;
  const delimText = "\n∞∞∞text-a\n";

  dispatch(
    state.update(
      {
        changes: {
          from: block.content.to,
          insert: delimText,
        },
        selection: EditorSelection.cursor(block.content.to + delimText.length),
      },
      {
        scrollIntoView: true,
        userEvent: "input",
      },
    ),
  );
  return true;
}

// note: using state, dispatch because note all callers have view
export function changeLanguageTo(state: EditorState, dispatch: EditorView["dispatch"], block: Block, language: string, auto: boolean): void {
  if (state.readOnly) return;
  const delimRegex = /^\n∞∞∞[a-z]+?(-a)?\n/g;
  if (state.doc.sliceString(block.delimiter.from, block.delimiter.to).match(delimRegex)) {
    dispatch(
      state.update({
        changes: {
          from: block.delimiter.from,
          to: block.delimiter.to,
          insert: `\n∞∞∞${language}${auto ? "-a" : ""}\n`,
        },
        annotations: [heynoteEvent.of(LANGUAGE_CHANGE)],
      }),
    );
  } else {
    throw new Error("Invalid delimiter: " + state.doc.sliceString(block.delimiter.from, block.delimiter.to));
  }
}

export function changeCurrentBlockLanguage(view: EditorView, language: string, auto: boolean): void {
  const block = getActiveNoteBlock(view.state);
  if (!block) return;
  changeLanguageTo(view.state, view.dispatch, block, language, auto);
}

function updateSel(sel: EditorSelection, by: (range: SelectionRange) => SelectionRange): EditorSelection {
  return EditorSelection.create(sel.ranges.map(by), sel.mainIndex);
}

function setSel(state: EditorState, selection: EditorSelection) {
  return state.update({ selection, scrollIntoView: true, userEvent: "select" });
}

function extendSel(state: EditorState, dispatch: EditorView["dispatch"], how: (range: SelectionRange) => SelectionRange): boolean {
  let selection = updateSel(state.selection, (range) => {
    let head = how(range);
    return EditorSelection.range(range.anchor, head.head, head.goalColumn, head.bidiLevel || undefined);
  });
  if (selection.eq(state.selection)) return false;
  dispatch(setSel(state, selection));
  return true;
}

function moveSel(state: EditorState, dispatch: EditorView["dispatch"], how: (range: SelectionRange) => SelectionRange): boolean {
  let selection = updateSel(state.selection, how);
  if (selection.eq(state.selection)) return false;
  dispatch(setSel(state, selection));
  return true;
}

function previousBlock(state: EditorState, range: SelectionRange): SelectionRange {
  const blocks = state.field(blockState);
  if (blocks.length === 0) return range;
  const block = getNoteBlockFromPos(state, range.head);
  if (!block) return range;
  if (range.head === block.content.from) {
    const index = blocks.indexOf(block);
    const previousBlockIndex = index > 0 ? index - 1 : 0;
    const targetBlock = blocks[previousBlockIndex];
    if (!targetBlock) return range;
    return EditorSelection.cursor(targetBlock.content.from);
  } else {
    return EditorSelection.cursor(block.content.from);
  }
}

function nextBlock(state: EditorState, range: SelectionRange): SelectionRange {
  const blocks = state.field(blockState);
  if (blocks.length === 0) return range;
  const block = getNoteBlockFromPos(state, range.head);
  if (!block) return range;
  if (range.head === block.content.to) {
    const index = blocks.indexOf(block);
    const nextBlockIndex = index < blocks.length - 1 ? index + 1 : index;
    const targetBlock = blocks[nextBlockIndex];
    if (!targetBlock) return range;
    return EditorSelection.cursor(targetBlock.content.to);
  } else {
    return EditorSelection.cursor(block.content.to);
  }
}

function nextBlockNo(index: number, state: EditorState, range: SelectionRange): SelectionRange {
  const blocks = state.field(blockState);
  const block = blocks[index];
  if (!block) return range;
  if (range.head === block.content.to) {
    const nextBlockIndex = index < blocks.length - 1 ? index + 1 : index;
    const targetBlock = blocks[nextBlockIndex];
    if (!targetBlock) return range;
    return EditorSelection.cursor(targetBlock.content.to);
  } else {
    return EditorSelection.cursor(block.content.to);
  }
}

export function gotoBlock(view: EditorView, n: number) {
  let { state, dispatch } = view;
  return moveSel(state, dispatch, (range) => nextBlockNo(n, state, range));
}

export function gotoNextBlock({ state, dispatch }: EditorView) {
  return moveSel(state, dispatch, (range) => nextBlock(state, range));
}

export function selectNextBlock({ state, dispatch }: EditorView) {
  return extendSel(state, dispatch, (range) => nextBlock(state, range));
}

export function gotoPreviousBlock({ state, dispatch }: EditorView) {
  return moveSel(state, dispatch, (range) => previousBlock(state, range));
}

export function selectPreviousBlock({ state, dispatch }: EditorView) {
  return extendSel(state, dispatch, (range) => previousBlock(state, range));
}

function previousParagraph(state: EditorState, range: SelectionRange): SelectionRange {
  const blocks = state.field(blockState);
  let block = getNoteBlockFromPos(state, range.head);
  if (!block) return range;
  const blockIndex = blocks.indexOf(block);

  let seenContentLine = false;
  let pos;
  // if we're on the first row of a block, and it's not the first block, we start from the end of the previous block
  if (state.doc.lineAt(range.head).from === block.content.from && blockIndex > 0) {
    const prevBlock = blocks[blockIndex - 1];
    if (prevBlock) {
      block = prevBlock;
    }
    pos = state.doc.lineAt(block.content.to).from;
  } else {
    pos = state.doc.lineAt(range.head).from;
  }

  while (pos > block.content.from) {
    const line = state.doc.lineAt(pos);
    if (line.text.replace(/\s/g, "").length == 0) {
      if (seenContentLine) {
        return EditorSelection.cursor(line.from);
      }
    } else {
      seenContentLine = true;
    }
    // set position to beginning go previous line
    pos = state.doc.lineAt(line.from - 1).from;
  }
  return EditorSelection.cursor(block.content.from);
}

function nextParagraph(state: EditorState, range: SelectionRange): SelectionRange {
  const blocks = state.field(blockState);
  let block = getNoteBlockFromPos(state, range.head);
  if (!block) return range;
  const blockIndex = blocks.indexOf(block);

  let seenContentLine = false;
  let pos;
  // if we're at the last line of a block, and it's not the last block, we start from the beginning of the next block
  if (state.doc.lineAt(range.head).to === block.content.to && blockIndex < blocks.length - 1) {
    const nextBlockEl = blocks[blockIndex + 1];
    if (nextBlockEl) {
      block = nextBlockEl;
    }
    pos = state.doc.lineAt(block.content.from).to;
  } else {
    pos = state.doc.lineAt(range.head).to;
  }

  while (pos < block.content.to) {
    const line = state.doc.lineAt(pos);
    if (line.text.replace(/\s/g, "").length == 0) {
      if (seenContentLine) {
        return EditorSelection.cursor(line.from);
      }
    } else {
      seenContentLine = true;
    }
    // set position to beginning go previous line
    pos = state.doc.lineAt(line.to + 1).to;
  }
  return EditorSelection.cursor(block.content.to);
}

export function gotoNextParagraph({ state, dispatch }: EditorView) {
  return moveSel(state, dispatch, (range) => nextParagraph(state, range));
}

export function selectNextParagraph({ state, dispatch }: EditorView) {
  return extendSel(state, dispatch, (range) => nextParagraph(state, range));
}

export function gotoPreviousParagraph({ state, dispatch }: EditorView) {
  return moveSel(state, dispatch, (range) => previousParagraph(state, range));
}

export function selectPreviousParagraph({ state, dispatch }: EditorView) {
  return extendSel(state, dispatch, (range) => previousParagraph(state, range));
}

function newCursor(view: EditorView, below: boolean): void {
  const sel = view.state.selection;
  const ranges = sel.ranges;

  const newRanges: SelectionRange[] = [...ranges];
  for (const range of ranges) {
    let newRange = view.moveVertically(range, below);
    let exists = ranges.some((r) => newRange.eq(r));
    if (!exists) {
      newRanges.push(newRange);
    }
  }
  const newSelection = EditorSelection.create(newRanges, sel.mainIndex);
  view.dispatch({ selection: newSelection });
}

export function newCursorBelow(view: EditorView) {
  newCursor(view, true);
}

export function newCursorAbove(view: EditorView) {
  newCursor(view, false);
}

export function triggerCurrenciesLoaded({ state, dispatch }: EditorView) {
  // Trigger empty change transaction that is annotated with CURRENCIES_LOADED
  // This will make Math blocks re-render so that currency conversions are applied
  dispatch(
    state.update({
      changes: { from: 0, to: 0, insert: "" },
      annotations: [heynoteEvent.of(CURRENCIES_LOADED), Transaction.addToHistory.of(false)],
    }),
  );
}

export function moveCurrentBlockUp({ state, dispatch }: EditorView) {
  return moveCurrentBlock(state, dispatch, true);
}

export function moveCurrentBlockDown({ state, dispatch }: EditorView) {
  return moveCurrentBlock(state, dispatch, false);
}

function moveCurrentBlock(state: EditorState, dispatch: EditorView["dispatch"], up: boolean): boolean {
  if (state.readOnly) {
    return false;
  }

  const blocks = state.field(blockState);
  const currentBlock = getActiveNoteBlock(state);
  if (!currentBlock) return false;
  const blockIndex = blocks.indexOf(currentBlock);
  if ((up && blockIndex === 0) || (!up && blockIndex === blocks.length - 1)) {
    return false;
  }

  const dir = up ? -1 : 1;
  const neighborBlock = blocks[blockIndex + dir];
  if (!neighborBlock) return false;

  const currentBlockContent = state.sliceDoc(currentBlock.delimiter.from, currentBlock.content.to);
  const neighborBlockContent = state.sliceDoc(neighborBlock.delimiter.from, neighborBlock.content.to);
  const newContent = up ? currentBlockContent + neighborBlockContent : neighborBlockContent + currentBlockContent;

  const selectionRange = state.selection.asSingle().main;
  let newSelectionRange;
  if (up) {
    newSelectionRange = EditorSelection.range(
      selectionRange.anchor - currentBlock.delimiter.from + neighborBlock.delimiter.from,
      selectionRange.head - currentBlock.delimiter.from + neighborBlock.delimiter.from,
    );
  } else {
    newSelectionRange = EditorSelection.range(
      selectionRange.anchor + neighborBlock.content.to - neighborBlock.delimiter.from,
      selectionRange.head + neighborBlock.content.to - neighborBlock.delimiter.from,
    );
  }

  dispatch(
    state.update(
      {
        changes: {
          from: up ? neighborBlock.delimiter.from : currentBlock.delimiter.from,
          to: up ? currentBlock.content.to : neighborBlock.content.to,
          insert: newContent,
        },
        selection: newSelectionRange,
        annotations: [heynoteEvent.of(MOVE_BLOCK)],
      },
      {
        scrollIntoView: true,
        userEvent: "input",
      },
    ),
  );
  return true;
}

export const deleteBlock =
  (editor: EdnaEditor) =>
  ({ state, dispatch }: EditorView) => {
    const range = state.selection.asSingle().main;
    const blocks = state.field(blockState);
    let block: Block | undefined;
    let nextBlock: Block | undefined;
    for (let i = 0; i < blocks.length; i++) {
      const currentBlock = blocks[i];
      if (currentBlock && currentBlock.range.from <= range.head && currentBlock.range.to >= range.head) {
        block = currentBlock;
        if (i < blocks.length - 1) {
          nextBlock = blocks[i + 1];
        }
        break;
      }
    }

    if (!block) return false;

    let replace = "";
    let newSelection: number;

    if (blocks.length == 1) {
      replace = getBlockDelimiter(editor.defaultBlockToken, editor.defaultBlockAutoDetect);
      newSelection = replace.length;
    } else if (!nextBlock) {
      // if it's the last block, the cursor should go at the en of the previous block
      newSelection = block.delimiter.from;
    } else {
      // if there is a next block, we want the cursor to be at the beginning of that block
      newSelection = block.delimiter.from + (nextBlock.delimiter.to - nextBlock.delimiter.from);
    }

    dispatch(
      state.update({
        changes: {
          from: block.range.from,
          to: block.range.to,
          insert: replace,
        },
        selection: EditorSelection.cursor(newSelection),
        annotations: [heynoteEvent.of(DELETE_BLOCK)],
      }),
    );
    return true;
  };

export const deleteBlockSetCursorPreviousBlock =
  (editor: EdnaEditor) =>
  ({ state, dispatch }: EditorView): boolean => {
    const block = getActiveNoteBlock(state);
    if (!block) return false;
    const blocks = state.field(blockState);
    let replace = "";
    let newSelection = block.delimiter.from;
    if (blocks.length == 1) {
      replace = getBlockDelimiter(editor.defaultBlockToken, editor.defaultBlockAutoDetect);
      newSelection = replace.length;
    }
    dispatch(
      state.update({
        changes: {
          from: block.range.from,
          to: block.range.to,
          insert: replace,
        },
        selection: EditorSelection.cursor(newSelection),
        annotations: [heynoteEvent.of(DELETE_BLOCK)],
      }),
    );
    return true;
  };
