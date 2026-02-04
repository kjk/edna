import { indentLess, indentMore, redo } from "@codemirror/commands";
import { foldCode, unfoldCode } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { platform } from "../util";
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
} from "./block/commands";
import { formatBlockContent } from "./block/format-code";
import { copyCommand, cutCommand, pasteCommand } from "./copy-paste";
import { insertDateAndTime } from "./date-time";
import type { EdnaEditor } from "./editor";
import { foldBlock, toggleBlockFold, unfoldBlock } from "./fold-gutter";

const isMac = platform.isMac;

export function keymapFromSpec(specs: any[]) {
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

export function ednaKeymap(editor: EdnaEditor) {
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
    ["Alt-Shift-f", () => formatBlockContent(editor)],
    ["Mod-Alt-ArrowDown", newCursorBelow],
    ["Mod-Alt-ArrowUp", newCursorAbove],
    ["Alt-Mod-Shift-ArrowUp", moveCurrentBlockUp],
    ["Alt-Mod-Shift-ArrowDown", moveCurrentBlockDown],
    ["Alt-Shift-d", insertDateAndTime],

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

  return keymapFromSpec(spec);
}
