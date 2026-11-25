import {
  cursorCharLeft,
  cursorCharRight,
  cursorGroupLeft,
  cursorGroupRight,
  cursorLineDown,
  cursorLineEnd,
  cursorLineStart,
  cursorLineUp,
  cursorPageDown,
  cursorPageUp,
  deleteCharBackward,
  deleteCharForward,
  deleteGroupBackward,
  deleteToLineEnd,
  redo,
  selectCharLeft,
  selectCharRight,
  selectGroupLeft,
  selectGroupRight,
  selectLineDown,
  selectLineEnd,
  selectLineStart,
  selectLineUp,
  selectPageDown,
  selectPageUp,
  splitLine,
  undo,
} from "@codemirror/commands";
import { Prec, type Extension } from "@codemirror/state";
import { keymap, type Command, type KeyBinding } from "@codemirror/view";
import { transposeChars } from "./block/transpose-chars";
import { collapseSelectionToHeads, consume, editCommand } from "./cmutils";
import { copyCommand, cutCommand, pasteCommand } from "./copy-paste";
import type { MultiBlockEditor } from "./editor";

export function emacsKeymap(editor: MultiBlockEditor): Extension[] {
  const meta = editor.emacsMetaKey === "meta" ? "Meta" : editor.emacsMetaKey === "ctrl" ? "Ctrl" : "Alt";
  const movement = (key: string, move: Command, select: Command): KeyBinding => ({
    key,
    run: consume((view) => (editor.emacsMarkMode ? select : move)(view)),
    shift: consume(select),
  });
  const edit = (key: string, run: Command): KeyBinding => ({ key, run: editCommand(run) });

  const bindings: KeyBinding[] = [
    movement("Ctrl-b", cursorCharLeft, selectCharLeft),
    movement("Ctrl-f", cursorCharRight, selectCharRight),
    movement("Ctrl-p", cursorLineUp, selectLineUp),
    movement("Ctrl-n", cursorLineDown, selectLineDown),
    movement("Ctrl-a", cursorLineStart, selectLineStart),
    movement("Ctrl-e", cursorLineEnd, selectLineEnd),
    movement("Ctrl-ArrowLeft", cursorGroupLeft, selectGroupLeft),
    movement("Ctrl-ArrowRight", cursorGroupRight, selectGroupRight),
    movement("Ctrl-v", cursorPageDown, selectPageDown),
    movement(meta + "-v", cursorPageUp, selectPageUp),
    { key: "Ctrl-Space", run: consume(() => (editor.emacsMarkMode = !editor.emacsMarkMode)) },
    {
      key: "Ctrl-g",
      run: consume((view) => {
        editor.emacsMarkMode = false;
        collapseSelectionToHeads(view);
      }),
    },
    edit("Ctrl-d", deleteCharForward),
    edit("Ctrl-h", deleteCharBackward),
    edit("Ctrl-k", deleteToLineEnd),
    edit("Ctrl-Alt-h", deleteGroupBackward),
    edit("Ctrl-o", splitLine),
    edit("Ctrl-t", transposeChars),
    { key: "Ctrl-y", run: consume((view) => void pasteCommand(view)) },
    { key: "Ctrl-w", run: cutCommand(editor), preventDefault: true },
    { key: meta + "-w", run: copyCommand(editor), preventDefault: true },
    edit("Ctrl-Shift--", undo),
    edit("Ctrl-.", redo),
  ];
  return [Prec.highest(keymap.of(bindings))];
}
