import { indentLess, indentMore, redo } from "@codemirror/commands";
import { keymap } from "@codemirror/view";
import {
  createScratchNote,
  openBlockSelector,
  openCommandPalette,
  openFunctionSelector,
  openHistorySelector,
  openLanguageSelector,
  openNoteSelector,
  smartRun,
} from "../globals.js";
import { platform } from "../util.js";
import {
  addNewBlockAfterCurrent,
  addNewBlockAfterLast,
  addNewBlockBeforeCurrent,
  addNewBlockBeforeFirst,
  gotoNextBlock,
  gotoNextParagraph,
  gotoPreviousBlock,
  gotoPreviousParagraph,
  insertNewBlockAtCursor,
  moveCurrentBlockDown,
  moveCurrentBlockUp,
  moveLineDown,
  moveLineUp,
  newCursorAbove,
  newCursorBelow,
  selectAll,
  selectNextBlock,
  selectNextParagraph,
  selectPreviousBlock,
  selectPreviousParagraph,
} from "./block/commands.js";
import { formatBlockContent } from "./block/format-code.js";
import { copyCommand, cutCommand, pasteCommand } from "./copy-paste.js";

export function keymapFromSpec(specs) {
  return keymap.of(
    specs.map((spec) => {
      if (spec.run) {
        if ("preventDefault" in spec) {
          return spec;
        } else {
          return { ...spec, preventDefault: true };
        }
      } else {
        const [key, run] = spec;
        return {
          key,
          run,
          preventDefault: true,
        };
      }
    }),
  );
}

/**
 * @param {import("./editor.js").HeynoteEditor} editor
 */
export function ednaKeymap(editor) {
  let spec = [
    ["Mod-c", copyCommand(editor)],
    ["Mod-v", pasteCommand],
    ["Mod-x", cutCommand(editor)],
    ["Tab", indentMore],
    ["Shift-Tab", indentLess],
    ["Alt-n", createScratchNote],
    ["Alt-Shift-Enter", addNewBlockBeforeFirst(editor)],
    ["Mod-Shift-Enter", addNewBlockAfterLast(editor)],
    ["Alt-Enter", addNewBlockBeforeCurrent(editor)],
    ["Mod-Enter", addNewBlockAfterCurrent(editor)],
    ["Mod-Alt-Enter", insertNewBlockAtCursor(editor)],
    ["Mod-a", selectAll],
    ["Alt-ArrowUp", moveLineUp],
    ["Alt-ArrowDown", moveLineDown],
    ["Mod-l", openLanguageSelector],
    ["Mod-e", smartRun],
    [
      "Alt-Shift-r",
      () => {
        openFunctionSelector(false);
      },
    ],
    ["Mod-b", openBlockSelector],
    ["Mod-k", openNoteSelector],
    ["Alt-0", openNoteSelector],
    ["Mod-o", openNoteSelector],
    ["Mod-p", openNoteSelector],
    ["Mod-Shift-p", openCommandPalette],
    ["Mod-Shift-k", openCommandPalette],
    ["Mod-Shift-o", openCommandPalette],
    ["Mod-h", openHistorySelector],
    ["Alt-Shift-f", formatBlockContent],
    ["Mod-Alt-ArrowDown", newCursorBelow],
    ["Mod-Alt-ArrowUp", newCursorAbove],
    // https://github.com/kjk/edna/issues/87
    // this is a "open command palette" shortcut
    //    ["Mod-Shift-k", deleteLine],
    {
      key: "Mod-ArrowUp",
      run: gotoPreviousBlock,
      shift: selectPreviousBlock,
    },
    { key: "Mod-ArrowDown", run: gotoNextBlock, shift: selectNextBlock },
    {
      key: "Ctrl-ArrowUp",
      run: gotoPreviousParagraph,
      shift: selectPreviousParagraph,
    },
    {
      key: "Ctrl-ArrowDown",
      run: gotoNextParagraph,
      shift: selectNextParagraph,
    },
    ["Mod-Shift-Alt-ArrowUp", moveCurrentBlockUp],
    ["Mod-Shift-Alt-ArrowDown", moveCurrentBlockDown],
  ];
  // for some reason CodeMirror uses Ctrl + Y on Windows
  // and only binds Mod-Shift-z on Mac and Linux
  // Windows editors also use Ctrl-Shift-z
  if (platform.isWindows) {
    spec.push(["Mod-Shift-z", redo]);
  }
  return keymapFromSpec(spec);
}
