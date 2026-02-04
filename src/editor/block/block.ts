import { ensureSyntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { EditorState, RangeSet, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, EditorView, layer, lineNumbers, RectangleMarker, ViewPlugin, WidgetType } from "@codemirror/view";
import { heynoteEvent, LANGUAGE_CHANGE } from "../annotation";
import type { EdnaEditor } from "../editor";
import { SelectionChangeEvent } from "../event";
import { firstBlockDelimiterSize, getBlocksFromString, getBlocksFromSyntaxTree } from "./block-parsing";
import { mathBlock } from "./math";
import { emptyBlockSelected } from "./select-all";

export const delimiterRegex = /^\n∞∞∞[a-z]+?(-a)?\n$/;
export const delimiterRegexWithoutNewline = /^∞∞∞[a-z]+?(-a)?$/;

/**
 * Get the blocks from the document state.
 * If the syntax tree is available, we'll extract the blocks from that. Otherwise
 * the blocks are parsed from the string contents of the document, which is much faster
 * than waiting for the tree parsing to finish.
 */
export function getBlocks(state: EditorState): Block[] {
  if (syntaxTreeAvailable(state, state.doc.length)) {
    return getBlocksFromSyntaxTree(state);
  } else {
    return getBlocksFromString(state);
  }
}

export const blockState = StateField.define({
  create(state) {
    return getBlocks(state);
  },
  update(blocks, transaction) {
    // if blocks are empty it likely means we didn't get a parsed syntax tree, and then we want to update
    // the blocks on all updates (and not just document changes)
    if (transaction.docChanged || blocks.length === 0) {
      return getBlocks(transaction.state);
    }
    return blocks;
  },
});

function findBlockWithPos(blocks: Block[], pos: number): Block | undefined {
  for (let block of blocks) {
    let r = block.range;
    if (r.from <= pos && r.to >= pos) {
      return block;
    }
  }
  return undefined;
}

function findBlocNokWithPos(blocks: Block[], pos: number): number {
  let no = 0;
  for (let block of blocks) {
    let r = block.range;
    if (r.from <= pos && r.to >= pos) {
      return no;
    }
    no++;
  }
  return -1;
}

export function getActiveNoteBlock(state: EditorState): Block | undefined {
  // find which block the cursor is in
  const range = state.selection.asSingle().ranges[0];
  let blocks = state.field(blockState);
  return findBlockWithPos(blocks, range.head);
}

export interface Block {
  range: { from: number; to: number };
  content: { from: number; to: number };
  delimiter: { from: number; to: number };
  language: {
    name: string;
    auto: boolean;
  };
}

export interface BlocksInfo {
  blocks: Block[];
  active: number;
}

export function getBlocksInfo(state: EditorState): BlocksInfo {
  // find which block the cursor is in
  const range = state.selection.asSingle().ranges[0];
  let blocks = state.field(blockState);
  let active = findBlocNokWithPos(blocks, range.head);
  if (active < 0) {
    active = 0;
  }
  return {
    blocks: blocks,
    active: active,
  };
}

export function getFirstNoteBlock(state: EditorState): Block {
  let blocks = state.field(blockState);
  return blocks[0] as Block;
}

export function getLastNoteBlock(state: EditorState): Block {
  let blocks = state.field(blockState);
  return blocks[blocks.length - 1] as Block;
}

export function getBlockN(state: EditorState, n: number): Block {
  let blocks = state.field(blockState);
  return blocks[n] as Block;
}

export function getNoteBlockFromPos(state: EditorState, pos: number): Block | undefined {
  let blocks = state.field(blockState);
  return findBlockWithPos(blocks, pos);
}

export function getNoteBlocksBetween(state: EditorState, from: number, to: number): Block[] {
  return state.field(blockState).filter((block) => block.range.from < to && block.range.to >= from);
}

export function getNoteBlocksFromRangeSet(state: EditorState, ranges: any): Block[] {
  const blocks = [];
  const seenBlockStarts = new Set();
  for (const range of ranges) {
    if (!seenBlockStarts.has(range.from)) {
      blocks.push(...getNoteBlocksBetween(state, range.from, range.to));
      seenBlockStarts.add(range.from);
    }
  }
  return blocks;
}

class NoteBlockStart extends WidgetType {
  isFirst: boolean;
  constructor(isFirst: boolean) {
    super();
    this.isFirst = isFirst;
  }
  eq(other: NoteBlockStart) {
    return this.isFirst === other.isFirst;
  }
  toDOM() {
    let wrap = document.createElement("div");
    wrap.className = "heynote-block-start" + (this.isFirst ? " first" : "");
    //wrap.innerHTML = "<br>"
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}
const noteBlockWidget = () => {
  const decorate = (state) => {
    const widgets = [];

    state.field(blockState).forEach((block: Block) => {
      let delimiter = block.delimiter;
      let deco = Decoration.replace({
        widget: new NoteBlockStart(delimiter.from === 0 ? true : false),
        inclusive: true,
        block: true,
        side: 0,
      });
      //console.log("deco range:", delimiter.from === 0 ? delimiter.from : delimiter.from+1,delimiter.to-1)
      widgets.push(deco.range(delimiter.from === 0 ? delimiter.from : delimiter.from + 1, delimiter.to - 1));
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  };

  const noteBlockStartField = StateField.define({
    create(state) {
      return decorate(state);
    },
    update(widgets, transaction) {
      // if widgets are empty it likely means we didn't get a parsed syntax tree, and then we want to update
      // the decorations on all updates (and not just document changes)
      // @ts-ignore
      if (transaction.docChanged || widgets.isEmpty) {
        return decorate(transaction.state);
      }

      //return widgets.map(transaction.changes);
      return widgets;
    },
    provide(field) {
      // @ts-ignore
      return EditorView.decorations.from(field);
    },
  });

  return noteBlockStartField;
};

function atomicRanges(view: EditorView) {
  let builder = new RangeSetBuilder();
  view.state.field(blockState).forEach((block) => {
    builder.add(block.delimiter.from, block.delimiter.to, {});
  });
  return builder.finish();
}
const atomicNoteBlock = ViewPlugin.fromClass(
  class {
    atomicRanges: any;
    constructor(view: EditorView) {
      this.atomicRanges = atomicRanges(view);
    }

    update(update) {
      if (update.docChanged) {
        this.atomicRanges = atomicRanges(update.view);
      }
    }
  },
  {
    provide: (plugin) =>
      EditorView.atomicRanges.of((view: EditorView) => {
        return view.plugin(plugin)?.atomicRanges || [];
      }),
  },
);

const blockLayer = layer({
  above: false,

  markers(view) {
    const markers = [];
    let idx = 0;
    //console.log("visible ranges:", view.visibleRanges[0].from, view.visibleRanges[0].to, view.visibleRanges.length)
    function rangesOverlaps(range1, range2) {
      return range1.from <= range2.to && range2.from <= range1.to;
    }
    const blocks = view.state.field(blockState);
    blocks.forEach((block) => {
      // make sure the block is visible
      if (!view.visibleRanges.some((range) => rangesOverlaps(block.content, range))) {
        idx++;
        return;
      }
      const fromCoords = view.coordsAtPos(Math.max(block.content.from, view.visibleRanges[0].from));
      if (!fromCoords) {
        // this often fires during refresh in vite
        return;
      }
      const fromCoordsTop = fromCoords.top;
      let toCoordsBottom = view.coordsAtPos(
        Math.min(block.content.to, view.visibleRanges[view.visibleRanges.length - 1].to),
      ).bottom;
      if (idx === blocks.length - 1) {
        // Calculate how much extra height we need to add to the last block
        let extraHeight =
          // @ts-ignore
          view.viewState.editorHeight -
          (view.defaultLineHeight + // when scrolling furthest down, one line is still shown at the top
            view.documentPadding.top +
            8);
        toCoordsBottom += extraHeight;
      }
      markers.push(
        new RectangleMarker(
          idx++ % 2 == 0 ? "block-even" : "block-odd",
          0,
          // Change "- 0 - 6" to "+ 1 - 6" on the following line, and "+ 1 + 13" to "+2 + 13" on the line below,
          // in order to make the block backgrounds to have no gap between them
          fromCoordsTop - (view.documentTop - view.documentPadding.top) - 1 - 6,
          null, // width is set to 100% in CSS
          toCoordsBottom - fromCoordsTop + 15,
        ),
      );
    });
    return markers;
  },

  update(update, dom) {
    return update.docChanged || update.viewportChanged;
  },

  class: "heynote-blocks-layer",
});

const preventFirstBlockFromBeingDeleted = EditorState.changeFilter.of((tr) => {
  //console.log("change filter!", tr)
  const protect = [];
  if (
    // @ts-ignore
    !tr.annotations.some((a) => a.type === heynoteEvent) &&
    firstBlockDelimiterSize
  ) {
    protect.push(0, firstBlockDelimiterSize);
  }
  // if the transaction is a search and replace, we want to protect all block delimiters
  if (
    // @ts-ignore
    tr.annotations.some((a) => a.value === "input.replace" || a.value === "input.replace.all")
  ) {
    const blocks = tr.startState.field(blockState);
    blocks.forEach((block) => {
      protect.push(block.delimiter.from, block.delimiter.to);
    });
    //console.log("protected ranges:", protect)
  }
  if (protect.length > 0) {
    return protect;
  }
});

/**
 * Transaction filter to prevent the selection from being before the first block
 */
const preventSelectionBeforeFirstBlock = EditorState.transactionFilter.of((tr) => {
  if (
    !firstBlockDelimiterSize ||
    // @ts-ignore
    tr.annotations.some((a) => a.type === heynoteEvent)
  ) {
    return tr;
  }
  tr?.selection?.ranges.forEach((range) => {
    // change the selection to after the first block if the transaction sets the selection before the first block
    if (range && range.from < firstBlockDelimiterSize) {
      // @ts-ignore
      range.from = firstBlockDelimiterSize;
      //console.log("changing the from selection to", markerSize)
    }
    if (range && range.to < firstBlockDelimiterSize) {
      // @ts-ignore
      range.to = firstBlockDelimiterSize;
      //console.log("changing the from selection to", markerSize)
    }
  });
  return tr;
});

export function getBlockLineFromPos(state: EditorState, pos: number) {
  const line = state.doc.lineAt(pos);
  const block = state
    .field(blockState)
    .find((block) => block.content.from <= line.from && block.content.to >= line.from);
  if (block) {
    const firstBlockLine = state.doc.lineAt(block.content.from).number;
    return {
      line: line.number - firstBlockLine + 1,
      col: pos - line.from + 1,
      length: line.length,
    };
  }
  return null;
}

export const blockLineNumbers = lineNumbers({
  formatNumber(lineNo, state) {
    if (state.doc.lines >= lineNo) {
      const lineInfo = getBlockLineFromPos(state, state.doc.line(lineNo).from);
      if (lineInfo !== null) {
        return `${lineInfo.line}`;
      }
    }
    return "";
  },
});

function getSelectionSize(state: EditorState, sel: any): number {
  let count = 0;
  let numBlocks = 0;
  for (const block of state.field(blockState)) {
    if (sel.from <= block.range.to && sel.to > block.range.from) {
      count += Math.min(sel.to, block.content.to) - Math.max(sel.from, block.content.from);
      numBlocks++;
    }
  }
  count += (numBlocks - 1) * 2; // add 2 for each block separator
  return count;
}

const emitCursorChange = (editor: EdnaEditor) =>
  ViewPlugin.fromClass(
    class {
      update(update) {
        // if the selection changed or the language changed (can happen without selection change),
        // emit a selection change event
        const langChange = update.transactions.some((tr) => tr.annotations.some((a) => a.value == LANGUAGE_CHANGE));
        if (update.selectionSet || langChange) {
          const cursorLine = getBlockLineFromPos(update.state, update.state.selection.main.head);

          const selectionSize = update.state.selection.ranges
            .map((sel) => getSelectionSize(update.state, sel))
            .reduce((a, b) => a + b, 0);

          const block = getActiveNoteBlock(update.state);
          if (block && cursorLine) {
            editor.element.dispatchEvent(
              new SelectionChangeEvent({
                cursorLine,
                selectionSize,
                language: block.language.name,
                languageAuto: block.language.auto,
              }),
            );
          }
        }
      }
    },
  );

export const noteBlockExtension = (editor: EdnaEditor) => {
  return [
    blockState,
    noteBlockWidget(),
    atomicNoteBlock,
    blockLayer,
    preventFirstBlockFromBeingDeleted,
    preventSelectionBeforeFirstBlock,
    emitCursorChange(editor),
    mathBlock,
    emptyBlockSelected,
  ];
};
