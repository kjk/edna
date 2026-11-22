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
import { EditorSelection, Prec, type Extension } from "@codemirror/state";
import { keymap, type Command, type KeyBinding } from "@codemirror/view";
import { transposeChars } from "./block/transpose-chars";
import { copyCommand, cutCommand, pasteCommand } from "./copy-paste";
import type { MultiBlockEditor } from "./editor";

let marking = false;

export function setEmacsMarkMode(value: boolean): void {
  marking = value;
}

export function emacsKeymap(editor: MultiBlockEditor): Extension[] {
  const meta = editor.emacsMetaKey === "meta" ? "Meta" : editor.emacsMetaKey === "ctrl" ? "Ctrl" : "Alt";
  const movement = (key: string, move: Command, select: Command): KeyBinding => ({
    key,
    run(view) {
      (marking ? select : move)(view);
      return true;
    },
    shift(view) {
      select(view);
      return true;
    },
  });
  const edit = (key: string, run: Command): KeyBinding => ({
    key,
    run(view) {
      if (!view.state.readOnly) run(view);
      return true;
    },
  });

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
    {
      key: "Ctrl-Space",
      run() {
        marking = !marking;
        return true;
      },
    },
    {
      key: "Ctrl-g",
      run(view) {
        setEmacsMarkMode(false);
        const { ranges, mainIndex } = view.state.selection;
        view.dispatch({
          selection: EditorSelection.create(
            ranges.map((range) => EditorSelection.cursor(range.head)),
            mainIndex,
          ),
          userEvent: "select",
        });
        return true;
      },
    },
    edit("Ctrl-d", deleteCharForward),
    edit("Ctrl-h", deleteCharBackward),
    edit("Ctrl-k", deleteToLineEnd),
    edit("Ctrl-Alt-h", deleteGroupBackward),
    edit("Ctrl-o", splitLine),
    edit("Ctrl-t", transposeChars),
    {
      key: "Ctrl-y",
      run(view) {
        void pasteCommand(view);
        return true;
      },
    },
    { key: "Ctrl-w", run: cutCommand(editor), preventDefault: true },
    { key: meta + "-w", run: copyCommand(editor), preventDefault: true },
    edit("Ctrl-Shift--", undo),
    edit("Ctrl-.", redo),
  ];
  return [Prec.highest(keymap.of(bindings))];
}
