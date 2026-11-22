import {
  EditorSelection,
  EditorState,
  Prec,
  Transaction,
  type ChangeSpec,
  type SelectionRange,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { getFirstNoteBlock, getNoteBlockFromPos } from "./block/block";
import type { MultiBlockEditor } from "./editor";
import { setEmacsMarkMode } from "./emacs";
import { parseDelimiterLine } from "./new-parser/node-types";
import type { SimpleRange } from "./types";

export function removeDelimitersFromPastedText(text: string, atLineStart = true, atLineEnd = true): string {
  const lines = text.split(/\r\n?|\n/);
  return lines
    .map((line, i) =>
      (i > 0 || atLineStart) && (i < lines.length - 1 || atLineEnd) && parseDelimiterLine(line) ? "" : line,
    )
    .join("\n");
}

function contextFilteredText(state: EditorState, text: string, from: number, to: number): string {
  return removeDelimitersFromPastedText(text, from === state.doc.lineAt(from).from, to === state.doc.lineAt(to).to);
}

function editableRange(state: EditorState, range: SelectionRange): SimpleRange {
  const firstContent = getFirstNoteBlock(state)?.contentFrom ?? 0;
  return { from: Math.max(firstContent, range.from), to: Math.max(firstContent, range.to) };
}

function writeSelection(view: EditorView, editor: MultiBlockEditor, cut: boolean, write: (text: string) => void) {
  const { state } = view;
  const { ranges, mainIndex } = state.selection;
  const text: string[] = [];
  const cuts: SimpleRange[] = [];
  const seenLines = new Set<number>();
  const linewise = ranges.every((range) => range.empty);
  for (const range of ranges) {
    const { from, to } = editableRange(state, range);
    if (range.empty && !linewise) {
      continue;
    }
    if (linewise) {
      const line = state.doc.lineAt(from);
      if (seenLines.has(line.number)) {
        continue;
      }
      seenLines.add(line.number);
      text.push(line.text);
      const block = getNoteBlockFromPos(state, from);
      if (line.to < (block?.to ?? state.doc.length)) {
        cuts.push({ from: line.from, to: line.to + 1 });
      } else {
        const start = line.from > (block?.contentFrom ?? 0) ? line.from - 1 : line.from;
        cuts.push({ from: start, to: line.to });
      }
    } else {
      text.push(contextFilteredText(state, state.sliceDoc(from, to), from, to));
      cuts.push({ from, to });
    }
  }
  write(text.join(state.lineBreak));
  setEmacsMarkMode(false);
  if (cut && !state.readOnly) {
    // Two selected ranges can include the same line break when one is a whole-line cut.
    cuts.sort((a, b) => a.from - b.from);
    const joined: SimpleRange[] = [];
    for (const cut of cuts) {
      const last = joined.at(-1);
      if (last && cut.from <= last.to) {
        last.to = Math.max(last.to, cut.to);
      } else {
        joined.push(cut);
      }
    }
    view.dispatch({ changes: joined, scrollIntoView: true, userEvent: "delete.cut" });
  } else if (!cut && editor.deselectOnCopy) {
    view.dispatch({
      selection: EditorSelection.create(
        ranges.map((range) => EditorSelection.cursor(range.head)),
        mainIndex,
      ),
      userEvent: "select",
    });
  }
}

export function heynoteCopyCut(editor: MultiBlockEditor) {
  return [
    EditorView.domEventHandlers({
      copy(event, view) {
        if (!event.clipboardData) return false;
        writeSelection(view, editor, false, (text) => event.clipboardData!.setData("text/plain", text));
        return true;
      },
      cut(event, view) {
        if (!event.clipboardData) return false;
        writeSelection(view, editor, true, (text) => event.clipboardData!.setData("text/plain", text));
        return true;
      },
      paste(event, view) {
        if (!event.clipboardData) return false;
        if (!view.state.readOnly) {
          insertPastedText(view, event.clipboardData.getData("text/plain"));
        }
        return true;
      },
    }),
    EditorView.clipboardOutputFilter.of((text, state) => {
      const { from, to } = state.selection.main;
      return contextFilteredText(state, text, from, to);
    }),
    // Native paste without clipboardData and drops go through CodeMirror.
    // Inspect the actual changes to judge delimiter boundaries.
    Prec.lowest(
      EditorState.transactionFilter.of((transaction) => {
        if (
          !transaction.docChanged ||
          !(
            transaction.isUserEvent("input.paste") ||
            transaction.isUserEvent("input.drop") ||
            transaction.isUserEvent("move.drop")
          )
        ) {
          return transaction;
        }
        const corrections: ChangeSpec[] = [];
        transaction.changes.iterChanges((from, to, newFrom, newTo, inserted) => {
          const text = inserted.toString();
          const filtered = contextFilteredText(transaction.startState, text, from, to);
          if (text !== filtered) {
            corrections.push({ from: newFrom, to: newTo, insert: filtered });
          }
        }, true);
        return corrections.length ? [transaction, { changes: corrections, sequential: true }] : transaction;
      }),
    ),
  ];
}

function clipboardWrite(editor: MultiBlockEditor, cut: boolean): (view: EditorView) => boolean {
  return (view) => {
    if (!navigator.clipboard?.writeText) {
      return false;
    }
    writeSelection(view, editor, cut, (text) => {
      navigator.clipboard
        .writeText(text)
        .catch((error: unknown) => console.error("Failed to write to clipboard", error));
    });
    return true;
  };
}

export function copyCommand(editor: MultiBlockEditor): (view: EditorView) => boolean {
  return clipboardWrite(editor, false);
}

export function cutCommand(editor: MultiBlockEditor): (view: EditorView) => boolean {
  return clipboardWrite(editor, true);
}

function insertPastedText(view: EditorView, text: string): void {
  if (text === "") {
    return;
  }
  const { state } = view;
  const lines = text.split(/\r\n?|\n/);
  const distribute = lines.length === state.selection.ranges.length;
  let index = 0;
  const changes = state.changeByRange((range) => {
    const { from, to } = editableRange(state, range);
    const insert = contextFilteredText(state, distribute ? lines[index++] : text, from, to);
    return {
      changes: { from, to, insert },
      range: EditorSelection.cursor(from + insert.length),
    };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input.paste" });
}

export async function pasteCommand(view: EditorView): Promise<void> {
  const { state } = view;
  if (state.readOnly || !navigator.clipboard?.readText) {
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (view.state.doc === state.doc && !view.state.readOnly) {
      insertPastedText(view, text);
    }
  } catch (error) {
    console.error("Failed to read from clipboard", error);
  }
}
