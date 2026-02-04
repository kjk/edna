<script lang="ts">
  import { onMount } from "svelte";
  import { syntaxTree } from "@codemirror/language";
  import { EditorView } from "@codemirror/view";
  import { appState } from "../appstate.svelte";
  import { loadCurrencies } from "../currency";
  import { EdnaEditor } from "../editor/editor";
  import { loadNote } from "../notes";
  import { getSettings } from "../settings.svelte";
  import { rememberEditor } from "../state";
  import { throwIf } from "../util";

  import type { SelectionChangeEvent } from "../editor/event";

  interface Props {
    class?: string;
    debugSyntaxTree: boolean;
    cursorChange: (e: SelectionChangeEvent) => void;
    docDidChange: () => void;
    didLoadNote: (name: string, noPushHistory: boolean) => void;
  }
  let { class: klass = "", debugSyntaxTree, cursorChange, docDidChange, didLoadNote }: Props = $props();

  let syntaxTreeDebugContent = $state(null);
  let settings = getSettings();
  let theme = settings.theme;

  let editor: EdnaEditor;

  let editorRef: HTMLElement;

  $effect(() => {
    /* TODO: it's not reactive if I do:
      editor?.setLineNumberGutter(settings.showLineNumberGutter);
      also, reactive breaks if I do:
      if (!editor) { return; }
    */
    let showLineNumberGutter = settings.showLineNumberGutter;
    editor?.setLineNumberGutter(showLineNumberGutter);
    let showFoldGutter = settings.showFoldGutter;
    editor?.setFoldGutter(showFoldGutter);
    let theme = settings.theme;
    editor?.setTheme(theme);
    let keymap = settings.keymap;
    let emacsMetaKey = settings.emacsMetaKey;
    editor?.setKeymap(keymap, emacsMetaKey);
    let bracketClosing = settings.bracketClosing;
    editor?.setBracketClosing(bracketClosing);
    let fontFamily = settings.fontFamily;
    let fontSize = settings.fontSize;
    editor?.setFont(fontFamily, fontSize);
    let tabSize = settings.tabSize;
    let useTabs = settings.indentType == "tabs";
    editor?.setTabsState(useTabs, tabSize);
  });

  function didLoadCurrencies() {
    editor?.didLoadCurrencies();
  }
  onMount(didMount);

  function didMount() {
    document.addEventListener("keydown", (e) => {
      // console.log(e);
      // prevent the default Save dialog from opening and save if dirty
      let isCtrlS = e.ctrlKey && e.key === "s";
      isCtrlS = isCtrlS || (e.metaKey && e.key === "s");
      if (isCtrlS) {
        e.preventDefault();
        // TODO: track isDirty state here?
        if (appState.isDirty) {
          editor.save();
        }
      }
    });

    window.document.addEventListener("currenciesLoaded", didLoadCurrencies);
    // forward events dispatched from editor.js

    function onSelChange(ev: SelectionChangeEvent) {
      cursorChange(ev);
    }
    editorRef.addEventListener("selectionChange", onSelChange);
    editorRef.addEventListener("docChanged", (e) => {
      docDidChange();
    });

    throwIf(!settings);
    let showLineNumberGutter = settings.showLineNumberGutter;
    let keymap = settings.keymap;
    let emacsMetaKey = settings.emacsMetaKey;
    let showFoldGutter = settings.showFoldGutter;
    let bracketClosing = settings.bracketClosing;
    let fontFamily = settings.fontFamily;
    let fontSize = settings.fontSize;

    let noteName = settings.currentNoteName;
    let useTabs = settings.indentType == "tabs";
    let tabSize = settings.tabSize;

    editor = new EdnaEditor({
      element: editorRef,
      noteName: noteName,
      theme: theme,
      keymap: keymap,
      emacsMetaKey: emacsMetaKey,
      showLineNumberGutter: showLineNumberGutter,
      showFoldGutter: showFoldGutter,
      bracketClosing: bracketClosing,
      fontFamily: fontFamily,
      fontSize: fontSize,
      tabSize: tabSize,
      useTabs: useTabs,
      // TODO: add a setting for this
      defaultBlockToken: "text",
      defaultBlockAutoDetect: true,
    });
    rememberEditor(editor);

    loadNote(noteName).then(async (content) => {
      await editor.loadContent(noteName, content || "");
      didLoadNote(noteName, false);
    });

    loadCurrencies();
    setInterval(loadCurrencies, 1000 * 3600 * 4);

    // if debugSyntaxTree prop is set, display syntax tree for debugging
    if (debugSyntaxTree) {
      setInterval(() => {
        function render(tree) {
          let lists = "";
          tree.iterate({
            enter(type) {
              lists += `<ul><li>${type.name} (${type.from},${type.to})`;
            },
            leave() {
              lists += "</ul>";
            },
          });
          return lists;
        }
        syntaxTreeDebugContent = render(syntaxTree(editor.view.state));
      }, 1000);
    }
    return () => {
      window.document.removeEventListener("currenciesLoaded", didLoadCurrencies);
    };
  }

  export function getBlocks() {
    return editor.getBlocks();
  }

  export function setSpellChecking(value) {
    // console.log("setSpellChecking:", value)
    let ce = document.querySelector('[contenteditable="true"]');
    if (!ce) {
      // console.log("no content editable found")
      return;
    }
    // console.log("found content editable")
    if (value) {
      ce.setAttribute("spellcheck", "true");
    } else {
      ce.setAttribute("spellcheck", "false");
    }
  }

  export function isSpellChecking() {
    let ce = document.querySelector('[contenteditable="true"]');
    if (!ce) {
      return false;
    }
    return ce.getAttribute("spellcheck") === "true";
  }

  export function getEditorView(): EditorView {
    return editor.view;
  }

  export function getEditor(): EdnaEditor {
    return editor;
  }

  export function focus() {
    editor.focus();
  }

  export async function openNote(name: string, skipSave = false, noPushHistory = false) {
    console.log("openNote:", name);
    if (!skipSave) {
      await editor.save();
    }
    const content = (await loadNote(name)) || "";
    await editor.loadContent(name, content);
    didLoadNote(name, noPushHistory);
  }
</script>

<div class="overflow-hidden {klass}">
  <div class="editor" bind:this={editorRef}></div>
  {#if debugSyntaxTree}
    <div class="debug-syntax-tree">
      {@html syntaxTreeDebugContent}
    </div>
  {/if}
</div>

<style lang="postcss">
  :global(.debug-syntax-tree) {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    width: 50%;
    background-color: rgba(240, 240, 240, 0.85);
    color: #000;
    font-size: 12px;
    font-family: monospace;
    padding: 10px;
    overflow: auto;
  }

  :global(.debug-syntax-tree ul) {
    padding-left: 20px;
  }

  :global(.debug-syntax-tree > ul) {
    padding-left: 0;
  }
</style>
