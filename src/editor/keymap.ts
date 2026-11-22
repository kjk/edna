import {
  cursorDocEnd,
  cursorDocStart,
  indentLess,
  redo,
  selectDocEnd,
  selectDocStart,
  toggleBlockComment,
  undo,
} from "@codemirror/commands";
import { foldCode, unfoldCode } from "@codemirror/language";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap, runScopeHandlers, type Command, type KeyBinding } from "@codemirror/view";
import {
  addNewBlockAfterCurrent,
  addNewBlockAfterLastAndScrollDown,
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
import { deleteLine } from "./block/delete-line";
import { isMac } from "./cmutils";
import { copyCommand, cutCommand, pasteCommand } from "./copy-paste";
import { insertDateAndTime, insertTime } from "./date-time";
import type { KeymapSpec, MultiBlockEditor } from "./editor";
import { foldBlock, toggleBlockFold, unfoldBlock } from "./fold-gutter";
import { insertIndentation } from "./indentation";
import { toggleCheckbox } from "./todo-checkbox";

function consume(run: (view: Parameters<Command>[0]) => void): Command {
  return (view) => {
    run(view);
    return true;
  };
}

export function keymapFromSpec(specs: KeymapSpec): Extension {
  return keymap.of(
    specs.map((spec): KeyBinding => {
      if (Array.isArray(spec)) {
        return { key: spec[0], run: consume(spec[1]) };
      }
      return { key: spec.key, run: consume(spec.run), shift: spec.shift && consume(spec.shift) };
    }),
  );
}

// macOS supplies the typed character for a lone Option chord. Try the
// corresponding shortcut and leave unbound Option chords to text input.
const optionShortcuts = Prec.high(
  EditorView.domEventHandlers({
    keydown(event, view) {
      if (
        !isMac() ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        !/^Key[A-Z]$/.test(event.code)
      ) {
        return false;
      }
      const key = event.code[3].toLowerCase();
      if (event.key.toLowerCase() === key) {
        return false;
      }
      return runScopeHandlers(
        view,
        new KeyboardEvent("keydown", {
          key,
          code: event.code,
          altKey: true,
          shiftKey: event.shiftKey,
        }),
        "editor",
      );
    },
  }),
);

export function ednaKeymap(editor: MultiBlockEditor): Extension {
  const edit = (run: Command): Command =>
    consume((view) => {
      if (!view.state.readOnly) run(view);
    });
  return [
    optionShortcuts,
    keymap.of([
      { key: "Mod-c", run: copyCommand(editor) },
      { key: "Mod-x", run: cutCommand(editor) },
      {
        key: "Mod-v",
        run: (view) => {
          if (!navigator.clipboard?.readText) return false;
          void pasteCommand(view);
          return true;
        },
      },
      { key: "Mod-a", run: consume(selectAll) },
      { key: "Mod-Home", run: cursorDocStart, shift: selectDocStart, preventDefault: true },
      { key: "Mod-End", run: cursorDocEnd, shift: selectDocEnd, preventDefault: true },
      { key: "Tab", run: edit(insertIndentation), shift: edit(indentLess) },
      { key: "Alt-Enter", run: edit(addNewBlockBeforeCurrent), shift: edit(addNewBlockBeforeFirst) },
      { key: "Mod-Enter", run: edit(addNewBlockAfterCurrent), shift: edit(addNewBlockAfterLastAndScrollDown) },
      { key: "Mod-Alt-Enter", run: edit(insertNewBlockAtCursor) },
      { key: "Mod-Shift-Space", run: edit(toggleCheckbox) },
      { key: "Alt-ArrowUp", run: edit(moveLineUp) },
      { key: "Alt-ArrowDown", run: edit(moveLineDown) },
      { key: "Mod-Alt-ArrowUp", run: consume(newCursorAbove), shift: edit(moveCurrentBlockUp) },
      { key: "Mod-Alt-ArrowDown", run: consume(newCursorBelow), shift: edit(moveCurrentBlockDown) },
      { key: "Mod-ArrowUp", run: consume(gotoPreviousBlock), shift: consume(selectPreviousBlock) },
      { key: "Mod-ArrowDown", run: consume(gotoNextBlock), shift: consume(selectNextBlock) },
      { mac: "Ctrl-ArrowUp", run: consume(gotoPreviousParagraph), shift: consume(selectPreviousParagraph) },
      { mac: "Ctrl-ArrowDown", run: consume(gotoNextParagraph), shift: consume(selectNextParagraph) },
      { key: "Mod-Shift-k", run: edit(deleteLine) },
      { key: "Alt-Shift-d", run: edit(insertDateAndTime) },
      { key: "Alt-Shift-t", run: edit(insertTime) },
      { key: "Alt-Shift-a", run: edit(toggleBlockComment) },
      { key: "Mod-Shift-[", run: consume(foldCode) },
      { key: "Mod-Shift-]", run: consume(unfoldCode) },
      { key: "Mod-Alt-[", run: consume(foldBlock(editor)) },
      { key: "Mod-Alt-]", run: consume(unfoldBlock(editor)) },
      { key: "Mod-Alt-.", run: consume(toggleBlockFold(editor)) },
      { key: "Mod-z", run: edit(undo), shift: edit(redo) },
      { key: "Mod-y", run: edit(redo) },
    ]),
  ];
}
