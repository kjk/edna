import {
  EditorSelection,
  EditorState,
  Prec,
  StateField,
  type Extension,
  type Text as DocText,
  type TransactionSpec,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  RectangleMarker,
  WidgetType,
  gutter,
  layer,
  type DecorationSet,
} from "@codemirror/view";
import { ednaEvent, isStructuralChange, kAddNewBlock, kSetContent } from "../annotation";
import { focusOnGutterMouseDown } from "../cmutils";
import type { MultiBlockEditor } from "../editor";
import { SelectionChangeEvent } from "../event";
import type { SimpleRange } from "../types";
import { getBlocksFromSyntaxTree, type NoteBlock } from "./block-parsing";
import { mathBlock } from "./math";
import { emptyBlockSelected } from "./select-all";

export interface Block extends NoteBlock {}

export const blockState = StateField.define<Block[]>({
  create: getBlocksFromSyntaxTree,
  update(blocks, tr) {
    return tr.docChanged ? getBlocksFromSyntaxTree(tr.state) : blocks;
  },
});

export function getBlocks(state: EditorState): Block[] {
  return state.field(blockState, false) ?? getBlocksFromSyntaxTree(state);
}

// text of block's content (without its header)
export function blockContentText(state: EditorState, block: Block): string {
  return state.sliceDoc(block.contentFrom, block.to);
}

export function getFirstNoteBlock(state: EditorState): Block {
  return getBlockN(state, 0);
}

export function getLastNoteBlock(state: EditorState): Block {
  return getBlocks(state).at(-1)!;
}

// block whose header starts at from
export function getBlockStartingAt(state: EditorState, from: number): Block | undefined {
  return getBlocks(state).find((block) => block.from === from);
}

export function getBlockN(state: EditorState, n: number): Block {
  return getBlocks(state)[n];
}

function findBlock(blocks: readonly Block[], pos: number): Block | undefined {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (blocks[mid].to < pos) low = mid + 1;
    else high = mid;
  }
  // When two blocks share an endpoint, the lower bound keeps the preceding block.
  const block = blocks[low];
  return block && pos >= block.from ? block : undefined;
}

export function getNoteBlockFromPos(state: EditorState, pos: number): Block | undefined {
  return findBlock(getBlocks(state), pos);
}

export function getActiveNoteBlock(state: EditorState): Block | undefined {
  return getNoteBlockFromPos(state, state.selection.main.head);
}

// numbers of the first and last line of block's content
export function blockLineRange(doc: DocText, block: Block): { first: number; last: number } {
  return { first: doc.lineAt(block.contentFrom).number, last: doc.lineAt(block.to).number };
}

// active block, or undefined if the editor is read-only
export function getEditableActiveBlock(state: EditorState): Block | undefined {
  return state.readOnly ? undefined : getActiveNoteBlock(state);
}

export interface BlocksInfo {
  blocks: Block[];
  active: number;
}

export function getBlocksInfo(state: EditorState): BlocksInfo {
  const blocks = getBlocks(state);
  return { blocks, active: findBlock(blocks, state.selection.main.head)?.index ?? 0 };
}

export function getNoteBlocksBetween(state: EditorState, from: number, to: number): Block[] {
  const blocks = getBlocks(state);
  const first = findBlock(blocks, from) ?? (from < blocks[0]?.from ? blocks[0] : undefined);
  const last = findBlock(blocks, to);
  if (!first || !last) return [];
  return blocks.slice(first.index, last.index + 1);
}

export function getNoteBlocksFromRangeSet(state: EditorState, ranges: Iterable<SimpleRange>): Block[] {
  const matches = new Set<Block>();
  for (const { from, to } of ranges) {
    for (const block of getNoteBlocksBetween(state, from, to)) matches.add(block);
  }
  return [...matches].sort((a, b) => a.index - b.index);
}

export function getBlockLineFromPos(state: EditorState, pos: number): { line: number; col: number; length: number } | null {
  const block = getNoteBlockFromPos(state, pos);
  if (!block) return null;

  const contentPos = Math.max(pos, block.contentFrom);
  const line = state.doc.lineAt(contentPos);
  const startLine = state.doc.lineAt(block.contentFrom);
  return {
    line: line.number - startLine.number + 1,
    col: contentPos - line.from + 1,
    length: line.length,
  };
}

class LineNumber extends GutterMarker {
  constructor(readonly label: string) {
    super();
  }

  eq(other: LineNumber): boolean {
    return this.label === other.label;
  }

  toDOM(): Text {
    return document.createTextNode(this.label);
  }
}

export const blockLineNumbers = gutter({
  class: "cm-lineNumbers",
  domEventHandlers: {
    mousedown: focusOnGutterMouseDown,
  },
  lineMarker(view, line) {
    const number = getBlockLineFromPos(view.state, line.from);
    return number ? new LineNumber(String(number.line)) : null;
  },
  initialSpacer: () => new LineNumber("99"),
  updateSpacer(spacer, update) {
    if (!update.docChanged) return spacer;
    let maxLines = 1;
    for (const block of getBlocks(update.state)) {
      const { first, last } = blockLineRange(update.state.doc, block);
      maxLines = Math.max(maxLines, last - first + 1);
    }
    return new LineNumber("9".repeat(Math.max(2, String(maxLines).length)));
  },
});

class BlockStart extends WidgetType {
  constructor(readonly first: boolean, readonly selected: boolean) {
    super();
  }

  eq(other: BlockStart): boolean {
    return this.first === other.first && this.selected === other.selected;
  }

  get estimatedHeight(): number {
    return this.first ? 0 : 12;
  }

  toDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = "edna-block-start";
    element.classList.toggle("first", this.first);
    element.classList.toggle("edna-empty-block-selected", this.selected);
    return element;
  }
}

function renderHeaders(state: EditorState): DecorationSet {
  // Leave later leading newlines in the layout so the gutters see separate text lines.
  const selected = state.field(emptyBlockSelected);
  return Decoration.set(
    getBlocks(state).map((block) =>
      Decoration.replace({
        block: true,
        inclusiveStart: true,
        inclusiveEnd: false,
        widget: new BlockStart(block.index === 0, selected === block.index),
      }).range(block.index === 0 ? block.from : block.from + 1, block.contentFrom),
    ),
  );
}

const headers = StateField.define<DecorationSet>({
  create: renderHeaders,
  update(previous, tr) {
    if (!tr.docChanged && tr.startState.field(emptyBlockSelected) === tr.state.field(emptyBlockSelected)) return previous;
    return renderHeaders(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const hiddenHeader = Decoration.mark({});
const atomicHeaders = EditorView.atomicRanges.from(blockState, (blocks) => {
  const ranges = Decoration.set(blocks.map((block) => hiddenHeader.range(block.from, block.contentFrom)));
  return () => ranges;
});

const blockBackgrounds = Prec.low(layer({
  above: false,
  class: "edna-blocks-layer",
  update: (update) => update.docChanged || update.viewportChanged || update.geometryChanged,
  markers(view) {
    const blocks = getNoteBlocksBetween(view.state, view.viewport.from, view.viewport.to);
    const { scrollDOM } = view;
    const origin = view.documentTop - scrollDOM.getBoundingClientRect().top + scrollDOM.scrollTop * view.scaleY;
    const width = scrollDOM.clientWidth * view.scaleX;
    const height = view.contentHeight - view.documentPadding.top;
    let top = blocks.length ? startHeight(view, blocks[0]) : 0;
    return blocks.map((block) => {
      const next = getBlockN(view.state, block.index + 1);
      const bottom = next ? startHeight(view, next) : height;
      const marker = new RectangleMarker(
        block.index % 2 ? "edna-block-background block-odd" : "edna-block-background block-even",
        0,
        origin + top * view.scaleY,
        width,
        Math.max(0, bottom - top) * view.scaleY,
      );
      top = bottom;
      return marker;
    });
  },
}));

function startHeight(view: EditorView, block: Block): number {
  const line = view.lineBlockAt(block.contentFrom);
  const content = Array.isArray(line.type) ? line.type.find((part) => part.from === block.contentFrom) : null;
  return (content?.top ?? line.top) - 6;
}

const blockStyle = EditorView.baseTheme({
  ".edna-block-start": { height: "12px" },
  ".edna-block-start.first": { height: "0" },
  ".edna-empty-block-selected": { boxShadow: "0 0 0 1px currentColor" },
});

const protectDelimiters = EditorState.changeFilter.of((tr) => {
  if (!tr.docChanged || isStructuralChange(tr)) return true;

  const blocks = getBlocks(tr.startState);
  if (!blocks.length) return true;
  if (tr.isUserEvent("input.replace")) {
    return blocks.flatMap((block) => [block.from, block.contentFrom]);
  }
  return [blocks[0].from, blocks[0].contentFrom];
});

const normalizeSelection = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || tr.annotation(ednaEvent) === kSetContent) return tr;
  const blocks = getBlocks(tr.state);
  if (!blocks.length) return tr;

  function normalize(pos: number): number {
    if (pos < blocks[0].contentFrom) return blocks[0].contentFrom;
    const block = findBlock(blocks, pos);
    return block ? Math.max(pos, block.contentFrom) : pos;
  }

  let changed = false;
  const ranges = tr.selection.ranges.map((range) => {
    const anchor = normalize(range.anchor);
    const head = normalize(range.head);
    // A cursor next to a header belongs to the content side for vertical motion.
    const startOfContent = range.empty && findBlock(blocks, head)?.contentFrom === head;
    const assoc = startOfContent ? 1 : range.assoc;
    if (anchor === range.anchor && head === range.head && assoc === range.assoc) return range;
    changed = true;
    if (anchor === head) return EditorSelection.cursor(head, assoc, range.bidiLevel ?? undefined, range.goalColumn);
    return EditorSelection.range(anchor, head, range.goalColumn, range.bidiLevel ?? undefined, assoc);
  });
  return changed ? [tr, { selection: EditorSelection.create(ranges, tr.selection.mainIndex), sequential: true }] : tr;
});

const selectionEvents = EditorView.updateListener.of((update) => {
  if (!update.docChanged && !update.selectionSet) return;
  const { state, view } = update;
  const head = state.selection.main.head;
  const block = getActiveNoteBlock(state);
  const cursorLine = getBlockLineFromPos(state, head);
  if (!block || !cursorLine) return;

  let selectionSize = 0;
  for (const range of state.selection.ranges) {
    if (range.empty) continue;
    const blocks = getNoteBlocksBetween(state, range.from, range.to);
    selectionSize += Math.max(0, blocks.length - 1) * 2;
    for (const selected of blocks) {
      selectionSize += Math.max(0, Math.min(range.to, selected.to) - Math.max(range.from, selected.contentFrom));
    }
  }
  view.dom.parentElement?.dispatchEvent(
    new SelectionChangeEvent({
      cursorLine,
      selectionSize,
      language: block.language,
      languageAuto: block.autoDetect,
    }),
  );
});

export function noteBlockExtension(_editor: MultiBlockEditor): Extension[] {
  return [
    blockState,
    emptyBlockSelected,
    headers,
    atomicHeaders,
    blockBackgrounds,
    blockStyle,
    protectDelimiters,
    normalizeSelection,
    selectionEvents,
    mathBlock,
  ];
}

// replaces content of block with text and puts the cursor cursorOffset characters
// into it (clamped to the new content)
export function replaceBlockContent(
  view: EditorView,
  block: Block,
  text: string,
  cursorOffset: number,
  spec: Omit<TransactionSpec, "changes" | "selection"> = {},
) {
  view.dispatch({
    changes: { from: block.contentFrom, to: block.to, insert: text },
    selection: { anchor: block.contentFrom + Math.min(text.length, Math.max(0, cursorOffset)) },
    scrollIntoView: true,
    ...spec,
  });
}

// inserts text (starting with a block header) at pos and puts the cursor at its end
export function insertBlockAt(
  view: EditorView,
  pos: number,
  text: string,
  spec: Omit<TransactionSpec, "changes" | "selection"> = {},
) {
  const insert = view.state.toText(text);
  view.dispatch({
    changes: { from: pos, insert },
    selection: { anchor: pos + insert.length },
    annotations: ednaEvent.of(kAddNewBlock),
    scrollIntoView: true,
    ...spec,
  });
}

export function insertAfterActiveBlock(view: EditorView, text: string): boolean {
  const active = getEditableActiveBlock(view.state);
  if (!active) return false;
  insertBlockAt(view, active.to, text);
  return true;
}
