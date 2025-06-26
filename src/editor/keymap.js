import { indentLess, indentMore, redo } from "@codemirror/commands";
import { foldCode, unfoldCode } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import {
  createScratchNote,
  openBlockSelector,
  openCommandPalette,
  openFindInNotes,
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
import { foldBlock, toggleBlockFold, unfoldBlock } from "./fold-gutter.js";

const isMac = platform.isMac;

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
 * @param {import("./editor.js").EdnaEditor} editor
 */
export function ednaKeymap(editor) {
  let spec = [
    ["Mod-c", copyCommand(editor)],
    ["Mod-v", pasteCommand],
    ["Mod-x", cutCommand(editor)],
    ["Tab", indentMore],
    ["Shift-Tab", indentLess],
    ["Alt-Shift-Enter", addNewBlockBeforeFirst],
    ["Mod-Shift-Enter", addNewBlockAfterLast],
    ["Alt-Enter", addNewBlockBeforeCurrent],
    ["Mod-Enter", addNewBlockAfterCurrent],
    ["Mod-Alt-Enter", insertNewBlockAtCursor],
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
    ["Mod-o", openNoteSelector],
    ["Mod-p", openNoteSelector],
    ["Mod-Shift-p", openCommandPalette],
    ["Mod-Shift-k", openCommandPalette],
    ["Mod-Shift-o", openCommandPalette],
    ["Mod-h", openHistorySelector],
    ["Mod-Shift-f", openFindInNotes],
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

    // fold blocks
    ...(isMac
      ? [
          {
            key: "Mod-Shift-[",
            run: foldCode,
          },
          {
            key: "Mod-Shift-]",
            run: unfoldCode,
          },
          {
            key: "Mod-Alt-[",
            run: foldBlock(editor),
          },
          {
            key: "Mod-Alt-]",
            run: unfoldBlock(editor),
          },
          {
            key: "Mod-Alt-.",
            run: toggleBlockFold(editor),
          },
        ]
      : [
          {
            key: "Ctrl-Shift-[",
            run: foldCode,
          },
          {
            key: "Ctrl-Shift-]",
            run: unfoldCode,
          },

          {
            key: "Ctrl-Alt-[",
            run: foldBlock(editor),
          },
          {
            key: "Ctrl-Alt-]",
            run: unfoldBlock(editor),
          },
          {
            key: "Ctrl-Alt-.",
            run: toggleBlockFold(editor),
          },
        ]),
  ];
  // for some reason CodeMirror uses Ctrl + Y on Windows
  // and only binds Mod-Shift-z on Mac and Linux
  // Windows editors also use Ctrl-Shift-z
  if (platform.isWindows) {
    spec.push(["Mod-Shift-z", redo]);
  }
  if (platform.isMac) {
    // I don't have a good Mac keybinding for this
    spec.push(["Alt-n", createScratchNote]);
  }

  return keymapFromSpec(spec);
}
