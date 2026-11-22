import { closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  crosshairCursor,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  scrollPastEnd,
  type KeyBinding,
  type Panel,
} from "@codemirror/view";

export type CreateFindPanelFn = (view: EditorView) => Panel;

function getDefaultKeymap() {
  // https://github.com/kjk/edna/issues/87
  // remove "Mod-Shift-k" which is "delete line" but we use it
  // for "open command palette"
  return defaultKeymap.filter((item: KeyBinding) => item.key !== "Shift-Mod-k");
}

function customSetup(createFindPanel: CreateFindPanelFn) {
  return [
    //lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    //foldGutter(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    EditorView.clickAddsSelectionRange.of((e) => e.altKey),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    //closeBrackets(),
    //autocompletion(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({
      createPanel: createFindPanel,
    }),
    EditorView.lineWrapping,
    scrollPastEnd(),
    // @ts-ignore
    keymap.of([
      ...closeBracketsKeymap,
      ...getDefaultKeymap(),
      ...searchKeymap,
      ...historyKeymap,
      // ...foldKeymap,
      //...completionKeymap,
      //...lintKeymap
    ]),
  ];
};
export { customSetup };
