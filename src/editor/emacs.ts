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
  deleteCharBackward,
  deleteCharForward,
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
  simplifySelection,
  splitLine,
  undo,
} from "@codemirror/commands";
import { EditorSelection, EditorState, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  gotoNextBlock,
  gotoNextParagraph,
  gotoPreviousBlock,
  gotoPreviousParagraph,
  selectAll,
  selectNextBlock,
  selectNextParagraph,
  selectPreviousBlock,
  selectPreviousParagraph,
} from "./block/commands";
import { transposeChars } from "./block/transpose-chars";
import { copyCommand, cutCommand, pasteCommand } from "./copy-paste";
import type { MultiBlockEditor } from "./editor";
import { ednaKeymap, keymapFromSpec } from "./keymap";

// if set to true, all keybindings for moving around is changed to their corresponding select commands
let emacsMarkMode = false;

export function setEmacsMarkMode(value: boolean) {
  emacsMarkMode = value;
}

/**
 * Return a command that will conditionally execute either the default command or the mark mode command
 */
function emacsMoveCommand(defaultCmd: (view: EditorView) => boolean, markModeCmd: (view: EditorView) => boolean) {
  return (view: EditorView) => (emacsMarkMode ? markModeCmd(view) : defaultCmd(view));
}

/**
 * C-g command that exits mark mode and simplifies selection
 */
function emacsCancel(view: EditorView) {
  simplifySelection(view);
  setEmacsMarkMode(false);
}

/**
 * Exit mark mode before executing selectAll command
 */
function emacsSelectAll(view: EditorView) {
  setEmacsMarkMode(false);
  return selectAll(view);
}

function emacsMetaKeyCommand(key: string, editor: MultiBlockEditor, command: (view: EditorView) => boolean) {
  const handler = (view: EditorView, event: KeyboardEvent) => {
    if ((editor.emacsMetaKey === "meta" && event.metaKey) || (editor.emacsMetaKey === "alt" && event.altKey)) {
      event.preventDefault();
      return command(view);
    } else {
      return false;
    }
  };
  return [
    { key, run: handler, preventDefault: false },
    { key: key.replace("Meta", "Alt"), run: handler, preventDefault: false },
  ];
}

export function emacsKeymap(editor: MultiBlockEditor) {
  return [
    ednaKeymap(editor),
    Prec.highest(
      keymapFromSpec([
        ["Ctrl-Shift--", undo],
        ["Ctrl-.", redo],
        ["Ctrl-g", emacsCancel],
        ["ArrowLeft", emacsMoveCommand(cursorCharLeft, selectCharLeft)],
        ["ArrowRight", emacsMoveCommand(cursorCharRight, selectCharRight)],
        ["ArrowUp", emacsMoveCommand(cursorLineUp, selectLineUp)],
        ["ArrowDown", emacsMoveCommand(cursorLineDown, selectLineDown)],
        {
          key: "Ctrl-ArrowLeft",
          run: emacsMoveCommand(cursorGroupLeft, selectGroupLeft),
          shift: selectGroupLeft,
        },
        {
          key: "Ctrl-ArrowRight",
          run: emacsMoveCommand(cursorGroupRight, selectGroupRight),
          shift: selectGroupRight,
        },

        ["Ctrl-d", deleteCharForward],
        ["Ctrl-h", deleteCharBackward],
        ["Ctrl-k", deleteToLineEnd],
        ["Ctrl-o", splitLine],
        ["Ctrl-t", transposeChars],
        ["Ctrl-v", cursorPageDown],

        ["Ctrl-y", pasteCommand],
        ["Ctrl-w", cutCommand(editor)],
        ...emacsMetaKeyCommand("Meta-w", editor, copyCommand(editor)),

        {
          key: "Ctrl-b",
          run: emacsMoveCommand(cursorCharLeft, selectCharLeft),
          shift: selectCharLeft,
        },
        {
          key: "Ctrl-f",
          run: emacsMoveCommand(cursorCharRight, selectCharRight),
          shift: selectCharRight,
        },
        {
          key: "Ctrl-p",
          run: emacsMoveCommand(cursorLineUp, selectLineUp),
          shift: selectLineUp,
        },
        {
          key: "Ctrl-n",
          run: emacsMoveCommand(cursorLineDown, selectLineDown),
          shift: selectLineDown,
        },
        {
          key: "Ctrl-a",
          run: emacsMoveCommand(cursorLineStart, selectLineStart),
          shift: selectLineStart,
        },
        {
          key: "Ctrl-e",
          run: emacsMoveCommand(cursorLineEnd, selectLineEnd),
          shift: selectLineEnd,
        },
      ]),
    ),

    Prec.highest(
      keymapFromSpec([
        [
          "Ctrl-Space",
          (view: EditorView) => {
            emacsMarkMode = !emacsMarkMode;
          },
        ],
        ["Mod-a", emacsSelectAll],
        {
          key: "Mod-ArrowUp",
          run: emacsMoveCommand(gotoPreviousBlock, selectPreviousBlock),
          shift: selectPreviousBlock,
        },
        {
          key: "Mod-ArrowDown",
          run: emacsMoveCommand(gotoNextBlock, selectNextBlock),
          shift: selectNextBlock,
        },
        {
          key: "Ctrl-ArrowUp",
          run: emacsMoveCommand(gotoPreviousParagraph, selectPreviousParagraph),
          shift: selectPreviousParagraph,
        },
        {
          key: "Ctrl-ArrowDown",
          run: emacsMoveCommand(gotoNextParagraph, selectNextParagraph),
          shift: selectNextParagraph,
        },
      ]),
    ),
  ];
}
