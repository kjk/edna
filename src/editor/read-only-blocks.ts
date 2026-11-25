// read-only blocks: blocks whose delimiter ends with -ro (#57)
import { Annotation, EditorState, Facet, RangeSetBuilder, Transaction, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { delimiterLine, getBlocksFromString, type NoteBlock } from "../block-format";
import { ednaEvent, kSetContent } from "./annotation";
import { blockHeaderChange, getActiveNoteBlock, getBlocks } from "./block/block";

// a transaction with this annotation may change read-only blocks
export const allowReadOnlyBlockEdit = Annotation.define<boolean>();

// called when an edit by the user was rejected because it would change a read-only block
export const onReadOnlyBlockEdit = Facet.define<() => void>();

// identifies a read-only block by what must not change: language and content
function roKeys(blocks: NoteBlock[], doc: (from: number, to: number) => string): string[] {
  return blocks.filter((b) => b.readOnly).map((b) => `${delimiterLine(b.language, b.autoDetect, true)}\n${doc(b.contentFrom, b.to)}`);
}

/**
 * true if every read-only block in before also exists (same language and
 * content) in after. Blocks can still be moved, blocks around them changed
 * and new read-only blocks added
 */
export function readOnlyBlocksKept(before: string, after: string): boolean {
  let keysBefore = roKeys(getBlocksFromString(before), (f, t) => before.slice(f, t));
  return keysKept(keysBefore, after);
}

function keysKept(keysBefore: string[], after: string): boolean {
  if (keysBefore.length === 0) {
    return true;
  }
  let remaining = new Map<string, number>();
  for (let k of roKeys(getBlocksFromString(after), (f, t) => after.slice(f, t))) {
    remaining.set(k, (remaining.get(k) ?? 0) + 1);
  }
  for (let k of keysBefore) {
    let n = remaining.get(k) ?? 0;
    if (n === 0) {
      return false;
    }
    remaining.set(k, n - 1);
  }
  return true;
}

// rejects transactions that would change a read-only block. Checks the result
// of the whole transaction (instead of protecting ranges) so that e.g. moving
// a block either fully happens or doesn't
const protectReadOnlyBlocks = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.annotation(allowReadOnlyBlockEdit) || tr.annotation(ednaEvent) === kSetContent) {
    return tr;
  }
  let state = tr.startState;
  let keysBefore = roKeys(getBlocks(state), (f, t) => state.sliceDoc(f, t));
  if (keysKept(keysBefore, tr.newDoc.toString())) {
    return tr;
  }
  let byUser = ["input", "delete", "move", "undo", "redo"].some((e) => tr.isUserEvent(e));
  if (byUser) {
    let notify = state.facet(onReadOnlyBlockEdit);
    // not while the editor is in the middle of a transaction
    queueMicrotask(() => notify.forEach((f) => f()));
  }
  return [];
});

class ReadOnlyBadge extends WidgetType {
  eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    let el = document.createElement("span");
    el.className = "cm-edna-ro-badge";
    el.textContent = "read-only";
    return el;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

const roLine = Decoration.line({ class: "cm-edna-ro-line" });
const roBadge = Decoration.widget({ widget: new ReadOnlyBadge(), side: 1 });

function buildDecorations(view: EditorView): DecorationSet {
  let builder = new RangeSetBuilder<Decoration>();
  let { state } = view;
  for (let block of getBlocks(state)) {
    if (!block.readOnly) {
      continue;
    }
    let first = state.doc.lineAt(block.contentFrom);
    for (let { from, to } of view.visibleRanges) {
      let start = Math.max(from, block.contentFrom);
      let end = Math.min(to, block.to);
      for (let pos = start; pos <= end; ) {
        let line = state.doc.lineAt(pos);
        builder.add(line.from, line.from, roLine);
        if (line.number === first.number) {
          builder.add(line.to, line.to, roBadge);
        }
        pos = line.to + 1;
      }
    }
  }
  return builder.finish();
}

const readOnlyDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const readOnlyTheme = EditorView.baseTheme({
  ".cm-edna-ro-line": {
    boxShadow: "inset 3px 0 0 rgba(128, 128, 128, 0.45)",
  },
  ".cm-edna-ro-badge": {
    float: "right",
    fontSize: "11px",
    lineHeight: "1.6",
    padding: "0 6px",
    marginRight: "4px",
    opacity: "0.6",
    border: "1px solid currentColor",
    borderRadius: "3px",
    userSelect: "none",
    pointerEvents: "none",
  },
});

export function readOnlyBlocks(): Extension {
  return [protectReadOnlyBlocks, readOnlyDecorations, readOnlyTheme];
}

// makes the block with the cursor read-only or editable again
export function toggleBlockReadOnly(view: EditorView): boolean {
  let { state } = view;
  let block = getActiveNoteBlock(state);
  if (state.readOnly || !block) {
    return false;
  }
  view.dispatch({
    changes: blockHeaderChange(state, block, block.language, block.autoDetect, !block.readOnly),
    // not undoable: undo of making a block read-only would be rejected,
    // blocking all undo history before it
    annotations: [allowReadOnlyBlockEdit.of(true), Transaction.addToHistory.of(false)],
  });
  return true;
}
