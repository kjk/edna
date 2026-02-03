import { mount } from "svelte";
import { closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { EditorState } from "@codemirror/state";
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
} from "@codemirror/view";
import Find from "../components/Find.svelte";

function createFnddPanel(view) {
  const dom = document.createElement("div");
  const args = {
    target: dom,
    props: {
      view,
    },
  };
  // TODO: this leak, I don't see unmounting anywhere
  let comp = mount(Find, args);
  const update = (update) => {
    comp.update(update);
  };
  return {
    dom,
    top: true,
    update,
  };
}

// (The superfluous function calls around the list of extensions work
// around current limitations in tree-shaking software.)
/**
This is an extension value that just pulls together a number of
extensions that you might want in a basic editor. It is meant as a
convenient helper to quickly set up CodeMirror without installing
and importing a lot of separate packages.

Specifically, it includes...

 - [the default command bindings](https://codemirror.net/6/docs/ref/#commands.defaultKeymap)
 - [line numbers](https://codemirror.net/6/docs/ref/#view.lineNumbers)
 - [special character highlighting](https://codemirror.net/6/docs/ref/#view.highlightSpecialChars)
 - [the undo history](https://codemirror.net/6/docs/ref/#commands.history)
 - [a fold gutter](https://codemirror.net/6/docs/ref/#language.foldGutter)
 - [custom selection drawing](https://codemirror.net/6/docs/ref/#view.drawSelection)
 - [drop cursor](https://codemirror.net/6/docs/ref/#view.dropCursor)
 - [multiple selections](https://codemirror.net/6/docs/ref/#state.EditorState^allowMultipleSelections)
 - [reindentation on input](https://codemirror.net/6/docs/ref/#language.indentOnInput)
 - [the default highlight style](https://codemirror.net/6/docs/ref/#language.defaultHighlightStyle) (as fallback)
 - [bracket matching](https://codemirror.net/6/docs/ref/#language.bracketMatching)
 - [bracket closing](https://codemirror.net/6/docs/ref/#autocomplete.closeBrackets)
 - [autocompletion](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion)
 - [rectangular selection](https://codemirror.net/6/docs/ref/#view.rectangularSelection) and [crosshair cursor](https://codemirror.net/6/docs/ref/#view.crosshairCursor)
 - [active line highlighting](https://codemirror.net/6/docs/ref/#view.highlightActiveLine)
 - [active line gutter highlighting](https://codemirror.net/6/docs/ref/#view.highlightActiveLineGutter)
 - [selection match highlighting](https://codemirror.net/6/docs/ref/#search.highlightSelectionMatches)
 - [search](https://codemirror.net/6/docs/ref/#search.searchKeymap)
 - [linting](https://codemirror.net/6/docs/ref/#lint.lintKeymap)

(You'll probably want to add some language package to your setup
too.)

This extension does not allow customization. The idea is that,
once you decide you want to configure your editor more precisely,
you take this package's source (which is just a bunch of imports
and an array literal), copy it into your own code, and adjust it
as desired.
*/

function getDefaultKeymap() {
  // https://github.com/kjk/edna/issues/87
  // remove "Mod-Shift-k" which is "delete line" but we use it
  // for "open command palette"
  let keymap = defaultKeymap;
  for (let i = 0; i < keymap.length; i++) {
    const item = keymap[i];
    if (item.key === "Shift-Mod-k") {
      // @ts-ignore
      keymap.splice(i, 1);
      break;
    }
  }
  return keymap;
}

const customSetup = /*@__PURE__*/ (() => [
  //lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  //foldGutter(),
  drawSelection(),
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
    createPanel: createFnddPanel,
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
])();
/**
A minimal set of extensions to create a functional editor. Only
includes [the default keymap](https://codemirror.net/6/docs/ref/#commands.defaultKeymap), [undo
history](https://codemirror.net/6/docs/ref/#commands.history), [special character
highlighting](https://codemirror.net/6/docs/ref/#view.highlightSpecialChars), [custom selection
drawing](https://codemirror.net/6/docs/ref/#view.drawSelection), and [default highlight
style](https://codemirror.net/6/docs/ref/#language.defaultHighlightStyle).
*/
const minimalSetup = /*@__PURE__*/ (() => [
  highlightSpecialChars(),
  history(),
  drawSelection(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  // @ts-ignore
  keymap.of([...defaultKeymap, ...historyKeymap]),
])();

export { customSetup, minimalSetup };
