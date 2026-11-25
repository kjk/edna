import { EditorSelection, Facet, type EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { getBlockDelimiter, isBlockLanguageToken } from "../../block-format";
import { kAddNewBlock, kCurrenciesLoaded, kDeleteBlock, ednaEvent, kLanguageChange, kMoveBlock } from "../annotation";
import {
  blockHeaderChange,
  blockLineRange,
  editableRange,
  getActiveNoteBlock,
  getBlockN,
  getEditableActiveBlock,
  getFirstNoteBlock,
  getLastNoteBlock,
  getNoteBlockFromPos,
  type Block,
} from "./block";
export { moveLineDown, moveLineUp } from "./move-lines";
export { selectAll } from "./select-all";

export const defaultBlockDelimiter = Facet.define<string, string>({
  combine: (values) => values[0] ?? getBlockDelimiter("text", true),
});

export function insertNewBlockAtCursor({ state, dispatch }: EditorView): boolean {
  if (state.readOnly) return false;
  const first = getFirstNoteBlock(state);
  if (!first) return false;
  const changes = state.changeByRange((range) => {
    const block = getNoteBlockFromPos(state, range.head) ?? first;
    const delimiter = getBlockDelimiter(block.language, block.autoDetect);
    const { from, to } = editableRange(state, range);
    return { changes: { from, to, insert: delimiter }, range: EditorSelection.cursor(from + delimiter.length) };
  });
  dispatch(state.update(changes, {
    annotations: ednaEvent.of(kAddNewBlock),
    userEvent: "input.block",
    scrollIntoView: true,
  }));
  return true;
}

function addBlock(view: EditorView, block: Block | undefined, before: boolean, consumeTrailingLine = false, scrollToTop = false): boolean {
  const { state } = view;
  if (state.readOnly || !block) return false;
  const delimiter = state.facet(defaultBlockDelimiter);
  const to = before ? block.from : block.to;
  const cursorAtEnd = state.selection.ranges.length === 1 && state.selection.main.empty && state.selection.main.head === to;
  const from = consumeTrailingLine && cursorAtEnd && to > block.contentFrom && state.sliceDoc(to - 1, to) === "\n"
    ? to - 1
    : to;
  const needsSeparator = before && to === 0 && state.sliceDoc(0, 1) !== "\n";
  const cursor = from + delimiter.length;
  view.dispatch({
    changes: { from, to, insert: delimiter + (needsSeparator ? "\n" : "") },
    selection: EditorSelection.cursor(cursor),
    annotations: ednaEvent.of(kAddNewBlock),
    userEvent: "input.block",
    effects: scrollToTop ? EditorView.scrollIntoView(cursor, { y: "start", yMargin: 0 }) : undefined,
    scrollIntoView: !scrollToTop,
  });
  return true;
}

export function addNewBlockBeforeCurrent(view: EditorView): boolean {
  return addBlock(view, getActiveNoteBlock(view.state), true);
}

export function addNewBlockAfterCurrent(view: EditorView): boolean {
  return addBlock(view, getActiveNoteBlock(view.state), false, true);
}

export function addNewBlockBeforeFirst(view: EditorView): boolean {
  return addBlock(view, getFirstNoteBlock(view.state), true);
}

export function addNewBlockAfterLast(view: EditorView): boolean {
  return addBlock(view, getLastNoteBlock(view.state), false);
}

export function addNewBlockAfterLastAndScrollDown(view: EditorView): boolean {
  return addBlock(view, getLastNoteBlock(view.state), false, false, true);
}

export function changeLanguageTo(
  state: EditorState,
  dispatch: EditorView["dispatch"],
  block: Block,
  language: string,
  auto: boolean,
): void {
  if (!isBlockLanguageToken(language)) {
    throw new Error(`Invalid block language: ${language}`);
  }
  if (state.readOnly || (block.language === language && block.autoDetect === auto)) return;
  dispatch(state.update({
    changes: blockHeaderChange(state, block, language, auto, !!block.readOnly),
    annotations: ednaEvent.of(kLanguageChange),
  }));
}

export function changeCurrentBlockLanguage(view: EditorView, language: string, auto: boolean): void {
  const block = getActiveNoteBlock(view.state);
  if (block) changeLanguageTo(view.state, view.dispatch, block, language, auto);
}

export function gotoBlock(view: EditorView, n: number): boolean {
  const block = getBlockN(view.state, n);
  if (!block) return false;
  const next = view.state.selection.main.head === block.to ? getBlockN(view.state, n + 1) : undefined;
  view.dispatch({
    selection: EditorSelection.cursor(next?.to ?? block.to),
    scrollIntoView: true,
    userEvent: "select.block",
  });
  return true;
}

function blockEdge(state: EditorState, block: Block, pos: number, forward: boolean): number {
  if (forward) {
    if (pos < block.to) return block.to;
    return getBlockN(state, block.index + 1)?.to ?? block.to;
  }
  if (pos !== block.contentFrom) return block.contentFrom;
  return getBlockN(state, block.index - 1)?.contentFrom ?? block.contentFrom;
}

function paragraphEdge(state: EditorState, block: Block, pos: number, forward: boolean): number {
  const { doc } = state;
  let target = block;
  let { first, last } = blockLineRange(doc, target);
  let current = doc.lineAt(Math.max(target.contentFrom, pos)).number;
  if (forward ? current === last : current === first) {
    const neighbor = getBlockN(state, target.index + (forward ? 1 : -1));
    if (!neighbor) return forward ? target.to : target.contentFrom;
    target = neighbor;
    ({ first, last } = blockLineRange(doc, target));
    current = forward ? first : last;
  }

  const step = forward ? 1 : -1;
  const inBlock = () => current >= first && current <= last;
  while (inBlock() && !doc.line(current).text.trim()) current += step;
  while (inBlock() && doc.line(current).text.trim()) current += step;
  if (inBlock()) return doc.line(current).from;
  return forward ? target.to : target.contentFrom;
}

function navigate(view: EditorView, forward: boolean, extend: boolean, paragraphs: boolean): boolean {
  const { state } = view;
  const first = getFirstNoteBlock(state);
  if (!first) return false;
  const move = paragraphs ? paragraphEdge : blockEdge;
  const ranges = state.selection.ranges.map((range) => {
    const block = getNoteBlockFromPos(state, range.head) ?? first;
    const head = move(state, block, range.head, forward);
    return extend ? EditorSelection.range(range.anchor, head) : EditorSelection.cursor(head);
  });
  view.dispatch({
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    scrollIntoView: true,
    userEvent: paragraphs ? "select.paragraph" : "select.block",
  });
  return true;
}

export const gotoNextBlock = (view: EditorView): boolean => navigate(view, true, false, false);
export const selectNextBlock = (view: EditorView): boolean => navigate(view, true, true, false);
export const gotoPreviousBlock = (view: EditorView): boolean => navigate(view, false, false, false);
export const selectPreviousBlock = (view: EditorView): boolean => navigate(view, false, true, false);
export const gotoNextParagraph = (view: EditorView): boolean => navigate(view, true, false, true);
export const selectNextParagraph = (view: EditorView): boolean => navigate(view, true, true, true);
export const gotoPreviousParagraph = (view: EditorView): boolean => navigate(view, false, false, true);
export const selectPreviousParagraph = (view: EditorView): boolean => navigate(view, false, true, true);

function addVerticalCursor(view: EditorView, forward: boolean): void {
  const { state } = view;
  const ranges = state.selection.ranges;
  const edge = forward ? ranges[ranges.length - 1] : ranges[0];
  const first = getFirstNoteBlock(state);
  const start = first && edge.head < first.contentFrom ? EditorSelection.cursor(first.contentFrom) : edge;
  const cursor = view.moveVertically(start, forward);
  if (cursor.head === start.head || (first && cursor.head < first.contentFrom)) return;
  view.dispatch({
    selection: EditorSelection.create([...ranges, cursor], ranges.length),
    scrollIntoView: true,
    userEvent: "select.cursor",
  });
}

export const newCursorBelow = (view: EditorView): void => addVerticalCursor(view, true);
export const newCursorAbove = (view: EditorView): void => addVerticalCursor(view, false);

export function triggerCurrenciesLoaded(view: EditorView): void {
  view.dispatch({ annotations: ednaEvent.of(kCurrenciesLoaded) });
}

function moveBlock(view: EditorView, direction: -1 | 1): boolean {
  const { state } = view;
  const active = getEditableActiveBlock(state);
  if (!active) return false;
  const neighbor = getBlockN(state, active.index + direction);
  if (!neighbor) return false;
  const [before, after] = direction < 0 ? [neighbor, active] : [active, neighbor];
  const beforeText = state.sliceDoc(before.from, before.to);
  const afterText = state.sliceDoc(after.from, after.to);
  const startsWithNewline = beforeText.startsWith("\n");
  const replacement = startsWithNewline ? afterText + beforeText : afterText.slice(1) + "\n" + beforeText;
  const destination = direction < 0
    ? before.from + active.contentFrom - active.from - Number(!startsWithNewline)
    : before.from + afterText.length + active.contentFrom - active.from;
  const clamp = (pos: number) => destination + Math.min(active.to - active.contentFrom, Math.max(0, pos - active.contentFrom));
  const ranges = state.selection.ranges.map((range) => EditorSelection.range(clamp(range.anchor), clamp(range.head)));
  view.dispatch({
    changes: { from: before.from, to: after.to, insert: replacement },
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    annotations: ednaEvent.of(kMoveBlock),
    userEvent: "move.block",
    scrollIntoView: true,
  });
  return true;
}

export const moveCurrentBlockUp = (view: EditorView): boolean => moveBlock(view, -1);
export const moveCurrentBlockDown = (view: EditorView): boolean => moveBlock(view, 1);

export function deleteBlock(view: EditorView, block = getEditableActiveBlock(view.state)): boolean {
  const { state } = view;
  if (!block || block.readOnly || state.readOnly) return false;
  const next = getBlockN(state, block.index + 1);
  const previous = getBlockN(state, block.index - 1);
  const insert = next || previous ? "" : state.facet(defaultBlockDelimiter);
  const cursor = next ? block.from + next.contentFrom - next.from : block.from + insert.length;
  view.dispatch({
    changes: { from: block.from, to: block.to, insert },
    selection: EditorSelection.cursor(cursor),
    annotations: ednaEvent.of(kDeleteBlock),
    userEvent: "delete.block",
    scrollIntoView: true,
  });
  return true;
}
