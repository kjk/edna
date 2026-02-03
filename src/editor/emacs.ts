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
import { ednaKeymap, keymapFromSpec } from "./keymap";

// if set to true, all keybindings for moving around is changed to their corresponding select commands
let emacsMarkMode = false;

export function setEmacsMarkMode(value) {
  emacsMarkMode = value;
}

/**
 * Return a command that will conditionally execute either the default command or the mark mode command
 *
 * @param defaultCmd Default command to execute
 * @param {*} markModeCmd Command to execute if mark mode is active
 */
function emacsMoveCommand(defaultCmd, markModeCmd) {
  return (view) => (emacsMarkMode ? markModeCmd(view) : defaultCmd(view));
}

/**
 * C-g command that exits mark mode and simplifies selection
 */
function emacsCancel(view) {
  simplifySelection(view);
  setEmacsMarkMode(false);
}

/**
 * Exit mark mode before executing selectAll command
 */
function emacsSelectAll(view) {
  setEmacsMarkMode(false);
  return selectAll(view);
}

function emacsMetaKeyCommand(key, editor, command) {
  const handler = (view, event) => {
    if (
      (editor.emacsMetaKey === "meta" && event.metaKey) ||
      (editor.emacsMetaKey === "alt" && event.altKey)
    ) {
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

export function emacsKeymap(editor) {
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
          (view) => {
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
