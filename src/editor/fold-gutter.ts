import {
  codeFolding,
  foldable,
  foldedRanges,
  foldEffect,
  syntaxTree,
  unfoldAll,
  unfoldEffect,
} from "@codemirror/language";
import { EditorSelection, EditorState, type StateEffect, type Transaction } from "@codemirror/state";
import { BlockType, gutter, GutterMarker, type BlockInfo, type EditorView } from "@codemirror/view";
import { ADD_NEW_BLOCK, DELETE_BLOCK, heynoteEvent, LANGUAGE_CHANGE, MOVE_BLOCK, SET_CONTENT } from "./annotation";
import { getBlocks, getNoteBlockFromPos, getNoteBlocksFromRangeSet, type Block } from "./block/block";
import { FOLD_LABEL_LENGTH } from "./constants";
import type { MultiBlockEditor } from "./editor";
import type { SimpleRange } from "./types";

function foldRange(state: EditorState, block: Block): SimpleRange | null {
  const firstLine = state.doc.lineAt(block.contentFrom);
  if (firstLine.to >= block.to) return null;
  return { from: Math.min(firstLine.to, block.contentFrom + FOLD_LABEL_LENGTH), to: block.to };
}

const placeholders = codeFolding({
  preparePlaceholder(state, { from, to }) {
    return state.doc.lineAt(to).number - state.doc.lineAt(from).number + 1;
  },
  placeholderDOM(view, unfold, lines: number) {
    const element = view.dom.ownerDocument.createElement("span");
    element.className = "cm-foldPlaceholder";
    element.textContent = lines > 1 ? `… ${lines} lines` : "…";
    element.title = "Unfold";
    element.setAttribute("aria-label", "Unfold");
    element.onmousedown = (event) => event.preventDefault();
    element.onclick = unfold;
    return element;
  },
});

function editingUnfolds(tr: Transaction): StateEffect<SimpleRange>[] {
  const event = tr.annotation(heynoteEvent);
  if (
    !tr.docChanged ||
    tr.isUserEvent("undo") ||
    tr.isUserEvent("redo") ||
    event === SET_CONTENT ||
    event === LANGUAGE_CHANGE ||
    event === ADD_NEW_BLOCK ||
    event === DELETE_BLOCK ||
    event === MOVE_BLOCK
  )
    return [];

  const effects: StateEffect<SimpleRange>[] = [];
  const { startState, changes } = tr;
  foldedRanges(startState).between(0, startState.doc.length, (from, to) => {
    const firstLine = startState.doc.lineAt(from);
    let touched = false;
    changes.iterChangedRanges((start, end) => {
      if (start === end ? start >= firstLine.from && start <= to : start < to && end > firstLine.from) {
        touched = true;
      }
    });
    if (!touched) return;
    const nextFrom = changes.mapPos(from, 1);
    const nextTo = changes.mapPos(to, -1);
    if (nextFrom < nextTo) effects.push(unfoldEffect.of({ from: nextFrom, to: nextTo }));
  });
  return effects;
}

export const moveSelectionOutOfNewFolds = [
  placeholders,
  EditorState.transactionFilter.of((tr) => {
    const newFolds = tr.effects.filter((effect) => effect.is(foldEffect)).map((effect) => effect.value);
    const effects = editingUnfolds(tr);
    if (!newFolds.length) return effects.length ? [tr, { effects, sequential: true }] : tr;

    function reveal(pos: number, cursor: boolean) {
      return newFolds.find(({ from, to }) => from < pos && (pos < to || (cursor && pos === to)))?.from ?? pos;
    }
    const ranges = tr.newSelection.ranges.map((range) => {
      const anchor = reveal(range.anchor, range.empty);
      const head = reveal(range.head, range.empty);
      return anchor === range.anchor && head === range.head ? range : EditorSelection.range(anchor, head);
    });
    const selection = EditorSelection.create(ranges, tr.newSelection.mainIndex);
    if (selection.eq(tr.newSelection)) return effects.length ? [tr, { effects, sequential: true }] : tr;
    return [tr, { effects, selection, sequential: true }];
  }),
];

class FoldMarker extends GutterMarker {
  constructor(readonly folded: boolean) {
    super();
  }

  toDOM(view: EditorView) {
    const marker = view.dom.ownerDocument.createElement("span");
    marker.textContent = this.folded ? "›" : "⌄";
    marker.title = this.folded ? "Unfold line" : "Fold line";
    return marker;
  }
}

const foldedMarker = new FoldMarker(true);
const unfoldedMarker = new FoldMarker(false);

function foldOnLine(state: EditorState, line: BlockInfo): SimpleRange | undefined {
  let range: SimpleRange | undefined;
  foldedRanges(state).between(line.from, line.to, (from, to) => {
    if (from >= line.from && (!range || from < range.from)) range = { from, to };
  });
  return range;
}

function foldableLine(state: EditorState, line: BlockInfo): SimpleRange | null {
  const block = getNoteBlockFromPos(state, line.to);
  if (block?.contentFrom === line.from) {
    const range = foldRange(state, block);
    if (range) return range;
  }
  return foldable(state, line.from, line.to);
}

export function foldGutterExtension() {
  return [
    gutter({
      class: "cm-foldGutter",
      initialSpacer: () => foldedMarker,
      lineMarker(view, line) {
        if (foldOnLine(view.state, line)) return foldedMarker;
        return foldableLine(view.state, line) ? unfoldedMarker : null;
      },
      lineMarkerChange(update) {
        return (
          update.docChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state) ||
          foldedRanges(update.startState) !== foldedRanges(update.state)
        );
      },
      domEventHandlers: {
        mousedown(view) {
          view.focus();
          return true;
        },
        click(view, line) {
          if (Array.isArray(line.type)) {
            const part = line.type.find((item) => item.type === BlockType.Text);
            if (!part) return false;
            line = part;
          }
          if (line.type !== BlockType.Text) return false;
          const range = foldOnLine(view.state, line);
          const next = range ?? foldableLine(view.state, line);
          if (!next) return false;
          view.dispatch({ effects: (range ? unfoldEffect : foldEffect).of(next) });
          return true;
        },
      },
    }),
  ];
}

function selectedBlocks(view: EditorView): Block[] {
  return getNoteBlocksFromRangeSet(view.state, view.state.selection.ranges);
}

function updateFolds(view: EditorView, blocks: Block[], action: "fold" | "unfold" | "toggle") {
  const { state } = view;
  const ranges = blocks.flatMap((block) => foldRange(state, block) ?? []);
  const existing = foldedRanges(state);
  const status = ranges.map((range) => {
    let folded = false;
    existing.between(range.from, range.to, (from, to) => {
      if (range.from === from && range.to === to) folded = true;
    });
    return { range, folded };
  });
  const foldedCount = status.filter(({ folded }) => folded).length;
  const shouldFold = action === "fold" || (action === "toggle" && foldedCount * 2 <= status.length);
  const effect = shouldFold ? foldEffect : unfoldEffect;
  const effects = status.filter(({ folded }) => folded !== shouldFold).map(({ range }) => effect.of(range));
  if (effects.length) view.dispatch({ effects });
}

export const toggleBlockFold = (_editor: MultiBlockEditor) => (view: EditorView) =>
  updateFolds(view, selectedBlocks(view), "toggle");
export const foldBlock = (_editor: MultiBlockEditor) => (view: EditorView) =>
  updateFolds(view, selectedBlocks(view), "fold");
export const unfoldBlock = (_editor: MultiBlockEditor) => (view: EditorView) =>
  updateFolds(view, selectedBlocks(view), "unfold");
export const foldAllBlocks = (_editor: MultiBlockEditor) => (view: EditorView) =>
  updateFolds(view, getBlocks(view.state), "fold");
export const unfoldAlBlocks = (_editor: MultiBlockEditor) => (view: EditorView) =>
  updateFolds(view, getBlocks(view.state), "unfold");
export const unfoldEverything = (_editor: MultiBlockEditor) => (view: EditorView) => {
  unfoldAll(view);
};
