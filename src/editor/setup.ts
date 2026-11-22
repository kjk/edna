import { defaultKeymap, historyKeymap } from "@codemirror/commands";
import { markdownKeymap } from "@codemirror/lang-markdown";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
  scrollPastEnd,
  type Panel,
} from "@codemirror/view";

export type CreateFindPanelFn = (view: EditorView) => Panel;

export function customSetup(createFindPanel: CreateFindPanelFn): Extension[] {
  return [
    EditorState.allowMultipleSelections.of(true),
    EditorView.clickAddsSelectionRange.of((event) => event.altKey),
    drawSelection({ cursorBlinkRate: 1000 }),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    // A standalone mount must also have a bounded scroll viewport.
    EditorView.theme({ "&": { maxHeight: "100dvh" } }),
    scrollPastEnd(),
    highlightSpecialChars(),
    EditorView.lineWrapping,
    bracketMatching(),
    indentOnInput(),
    search({ createPanel: createFindPanel }),
    highlightSelectionMatches(),
    Prec.low(keymap.of(markdownKeymap)),
    Prec.lowest(keymap.of([...searchKeymap, ...historyKeymap, ...defaultKeymap])),
  ];
}
