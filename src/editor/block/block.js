import { ensureSyntaxTree } from "@codemirror/language";
import {
  EditorState,
  RangeSet,
  RangeSetBuilder,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  layer,
  lineNumbers,
  RectangleMarker,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";
import { IterMode } from "@lezer/common";
import { len, objectEqualDeep, startTimer } from "../../util.js";
import { heynoteEvent, LANGUAGE_CHANGE } from "../annotation.js";
import { SelectionChangeEvent } from "../event.js";
import { Document, Note, NoteDelimiter } from "../lang-heynote/parser.terms.js";
import { mathBlock } from "./math.js";
import { emptyBlockSelected } from "./select-all.js";

// tracks the size of the first delimiter
let firstBlockDelimiterSize;

/** @typedef {{
    name: string,
    auto: boolean,
}} BlockLanguage
*/

/** @typedef {{
  from: number,
  to: number,
 }} BlockRange */

/** @typedef {{
  language: BlockLanguage,
  content: BlockRange,
  delimiter: BlockRange,
  range: BlockRange,
}} Block */

/** @typedef {{
}} BlockWithNo */

/**
 * Original implementation was forcing syntax tree parse on whole document to get
 * block boundaries. That is slow for large documents (e.g. >300ms for 357kb doc)
 * which causes un-styled content to flash (e.g. exposing delimiters).
 * CodeMirror parses things incrementally, so this usually doesn't happen.
 * This implementation does same doc in 2ms
 * @param {EditorState} state
 * @returns {Block[]}
 */
function getBlocks(state) {
  firstBlockDelimiterSize = 0;
  let res = [];
  let doc = state.doc;
  let n = doc.length;
  if (n === 0) {
    return [];
  }
  let s = doc.sliceString(0, n);
  let delim = "\n∞∞∞";
  let delimLen = len(delim);
  for (let pos = 0; pos < doc.length; ) {
    let blockStart = s.indexOf(delim, pos);
    if (blockStart != pos) {
      // shouldn't happen
      break;
    }
    let langStart = blockStart + delimLen;
    let delimiterEnd = s.indexOf("\n", langStart);
    if (delimiterEnd < 0) {
      // shouldn't happen
      break;
    }
    let langFull = s.substring(langStart, delimiterEnd);
    let auto = false;
    let lang = langFull;
    if (langFull.endsWith("-a")) {
      auto = true;
      lang = langFull.substring(0, len(langFull) - 2);
    }
    let contentFrom = delimiterEnd + 1;
    let blockEnd = s.indexOf(delim, contentFrom);
    if (blockEnd < 0) {
      blockEnd = doc.length;
    }
    /** @type {Block} */
    let block = {
      language: {
        name: lang,
        auto: auto,
      },
      content: {
        from: contentFrom,
        to: blockEnd,
      },
      delimiter: {
        from: blockStart,
        to: delimiterEnd + 1,
      },
      range: {
        from: blockStart,
        to: blockEnd,
      },
    };
    res.push(block);
    pos = blockEnd;
  }
  if (len(res) > 0) {
    firstBlockDelimiterSize = res[0].delimiter.to;
  }
  return res;
}

/**
 * @param {EditorState} state
 * @param {number} timeout
 * @returns {Block[]}
 */
function getBlocksOriginal(state, timeout = 50) {
  const tree = ensureSyntaxTree(state, state.doc.length, timeout);
  if (!tree) {
    return [];
  }
  const blocks = [];
  tree.iterate({
    enter: (type) => {
      if (type.type.id == Document || type.type.id == Note) {
        return true;
      } else if (type.type.id === NoteDelimiter) {
        const langNode = type.node.getChild("NoteLanguage");
        const language = state.doc.sliceString(langNode.from, langNode.to);
        const isAuto = !!type.node.getChild("Auto");
        const contentNode = type.node.nextSibling;
        blocks.push({
          language: {
            name: language,
            auto: isAuto,
          },
          content: {
            from: contentNode.from,
            to: contentNode.to,
          },
          delimiter: {
            from: type.from,
            to: type.to,
          },
          range: {
            from: type.node.from,
            to: contentNode.to,
          },
        });
        return false;
      }
      return false;
    },
    mode: IterMode.IgnoreMounts,
  });
  firstBlockDelimiterSize = blocks[0]?.delimiter.to;
  return blocks;
}

let flagCompareGetBlocks = false;
/**
 * @param {EditorState} state
 * @param {number} timeout
 * @returns {Block[]}
 */
function getBlocksCompare(state, timeout = 50) {
  if (!flagCompareGetBlocks) {
    // let timer = startTimer();
    let res = getBlocks(state);
    // console.log("getBlocks2 took:", timer(), " ms");
    return res;
  }
  // TODO: for now keeping the old getBlocks() implementation and this
  // comparison code

  let timer1 = startTimer();
  let res1 = getBlocksOriginal(state, timeout);
  console.log("getBlocks took:", timer1(), " ms");
  let timer = startTimer();
  let res2 = getBlocks(state);
  console.log("getBlocks2 took:", timer(), " ms");
  if (len(res1) == len(res2)) {
    if (objectEqualDeep(res1, res2)) {
      console.log("great success!!!");
    } else {
      for (let i = 0; i < len(res1); i++) {
        console.log(`res1[${i}]:`, res1[i]);
        console.log(`res2[${i}]:`, res2[i]);
      }
    }
  } else {
    console.log("Not even lengths match!");
    for (let i = 0; i < len(res1); i++) {
      console.log(`res1[${i}]:`, res1[i]);
      console.log(`res2[${i}]:`, res2[i]);
    }
  }
  return res1;
}

export const blockState = StateField.define({
  create(state) {
    ensureSyntaxTree(state, state.doc.length, 1000);
    return getBlocksCompare(state, 1000);
  },
  update(blocks, transaction) {
    // if blocks are empty it likely means we didn't get a parsed syntax tree, and then we want to update
    // the blocks on all updates (and not just document changes)
    if (transaction.docChanged || blocks.length === 0) {
      blocks = getBlocksCompare(transaction.state, 50);
    }
    return blocks;
  },
});

/**
 * @param {Block[]} blocks
 * @param {number} pos
 * @returns {Block}
 */
function findBlockWithPos(blocks, pos) {
  for (let block of blocks) {
    let r = block.range;
    if (r.from <= pos && r.to >= pos) {
      return block;
    }
  }
  return undefined;
}

/**
 * @param {Block[]} blocks
 * @param {number} pos
 * @returns {number}
 */
function findBlocNokWithPos(blocks, pos) {
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

/**
 * @param {EditorState} state
 * @returns {Block}
 */
export function getActiveNoteBlock(state) {
  // find which block the cursor is in
  const range = state.selection.asSingle().ranges[0];
  // @ts-ignore
  let blocks = state.facet(blockState);
  return findBlockWithPos(blocks, range.head);
}

/** @typedef {{
  blocks: Block[],
  active: number,
}} BlocksInfo */

/**
 * @param {EditorState} state
 * @returns {BlocksInfo}
 */
export function getBlocksInfo(state) {
  // find which block the cursor is in
  const range = state.selection.asSingle().ranges[0];
  // @ts-ignore
  let blocks = state.facet(blockState);
  let active = findBlocNokWithPos(blocks, range.head);
  if (active < 0) {
    active = 0;
  }
  return {
    blocks: blocks,
    active: active,
  };
}

/**
 * @returns {Block}
 */
export function getFirstNoteBlock(state) {
  let blocks = state.facet(blockState);
  return blocks[0];
}

/**
 * @returns {Block}
 */
export function getLastNoteBlock(state) {
  let blocks = state.facet(blockState);
  return blocks[blocks.length - 1];
}

/**
 * @param {EditorState} state
 * @param {number} n
 */
export function getBlockN(state, n) {
  // @ts-ignore
  let blocks = state.facet(blockState);
  return blocks[n];
}

export function getNoteBlockFromPos(state, pos) {
  let blocks = state.facet(blockState);
  return findBlockWithPos(blocks, pos);
}

class NoteBlockStart extends WidgetType {
  constructor(isFirst) {
    super();
    this.isFirst = isFirst;
  }
  eq(other) {
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

    state.facet(blockState).forEach((block) => {
      let delimiter = block.delimiter;
      let deco = Decoration.replace({
        widget: new NoteBlockStart(delimiter.from === 0 ? true : false),
        inclusive: true,
        block: true,
        side: 0,
      });
      //console.log("deco range:", delimiter.from === 0 ? delimiter.from : delimiter.from+1,delimiter.to-1)
      widgets.push(
        deco.range(
          delimiter.from === 0 ? delimiter.from : delimiter.from + 1,
          delimiter.to - 1,
        ),
      );
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

function atomicRanges(view) {
  let builder = new RangeSetBuilder();
  view.state.facet(blockState).forEach((block) => {
    // @ts-ignore
    builder.add(block.delimiter.from, block.delimiter.to, {});
  });
  return builder.finish();
}
const atomicNoteBlock = ViewPlugin.fromClass(
  class {
    constructor(view) {
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
      // @ts-ignore
      EditorView.atomicRanges.of((view) => {
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
    // @ts-ignore
    const blocks = view.state.facet(blockState);
    blocks.forEach((block) => {
      // make sure the block is visible
      if (
        !view.visibleRanges.some((range) =>
          rangesOverlaps(block.content, range),
        )
      ) {
        idx++;
        return;
      }
      const fromCoords = view.coordsAtPos(
        Math.max(block.content.from, view.visibleRanges[0].from),
      );
      if (!fromCoords) {
        // this often fires during refresh in vite
        return;
      }
      const fromCoordsTop = fromCoords.top;
      let toCoordsBottom = view.coordsAtPos(
        Math.min(
          block.content.to,
          view.visibleRanges[view.visibleRanges.length - 1].to,
        ),
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
    tr.annotations.some(
      (a) => a.value === "input.replace" || a.value === "input.replace.all",
    )
  ) {
    // @ts-ignore
    const blocks = tr.startState.facet(blockState);
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
const preventSelectionBeforeFirstBlock = EditorState.transactionFilter.of(
  (tr) => {
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
  },
);

export function getBlockLineFromPos(state, pos) {
  const line = state.doc.lineAt(pos);
  const block = state
    .facet(blockState)
    .find(
      (block) =>
        block.content.from <= line.from && block.content.to >= line.from,
    );
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

function getSelectionSize(state, sel) {
  let count = 0;
  let numBlocks = 0;
  for (const block of state.facet(blockState)) {
    if (sel.from <= block.range.to && sel.to > block.range.from) {
      count +=
        Math.min(sel.to, block.content.to) -
        Math.max(sel.from, block.content.from);
      numBlocks++;
    }
  }
  count += (numBlocks - 1) * 2; // add 2 for each block separator
  return count;
}

const emitCursorChange = (editor) =>
  ViewPlugin.fromClass(
    class {
      update(update) {
        // if the selection changed or the language changed (can happen without selection change),
        // emit a selection change event
        const langChange = update.transactions.some((tr) =>
          tr.annotations.some((a) => a.value == LANGUAGE_CHANGE),
        );
        if (update.selectionSet || langChange) {
          const cursorLine = getBlockLineFromPos(
            update.state,
            update.state.selection.main.head,
          );

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

export const noteBlockExtension = (editor) => {
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
