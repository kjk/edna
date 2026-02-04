<script lang="ts">
  import { mount, onMount } from "svelte";
  import { syntaxTree } from "@codemirror/language";
  import { EditorView, type ViewUpdate } from "@codemirror/view";
  import { appState } from "../appstate.svelte";
  import { loadCurrencies } from "../currency";
  import { MultiBlockEditor } from "../editor/editor";
  import type { KeymapSpec } from "../editor/editor";
  import type { SelectionChangeEvent } from "../editor/event";
  import { getNoteMeta, saveNotesMetadata } from "../metadata";
  import { loadNote, saveNote } from "../notes";
  import { getSettings } from "../settings.svelte";
  import { objectEqualDeep, throwIf } from "../util";
  import Find from "./Find.svelte";

  function createFindPanel(view: EditorView) {
    const dom = document.createElement("div");
    const args = {
      target: dom,
      props: {
        view,
      },
    };
    // TODO: this leaks, I don't see unmounting anywhere
    let comp = mount(Find, args);
    const update = (update: ViewUpdate) => {
      comp.update(update);
    };
    return {
      dom,
      top: true,
      update,
    };
  }

  interface Props {
    class?: string;
    debugSyntaxTree: boolean;
    extraKeymap?: KeymapSpec;
    cursorChange: (e: SelectionChangeEvent) => void;
    docDidChange: () => void;
    didLoadNote: (name: string, noPushHistory: boolean) => void;
  }
  let { class: klass = "", debugSyntaxTree, extraKeymap, cursorChange, docDidChange, didLoadNote }: Props = $props();

  let syntaxTreeDebugContent: string | null = $state(null);
  let settings = getSettings();
  let theme = settings.theme;

  let editor: MultiBlockEditor;
  let currentNoteName: string;

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
    let fontFamily = settings.fontFamily!;
    let fontSize = settings.fontSize!;
    editor?.setFont(fontFamily, fontSize);
    let tabSize = settings.tabSize;
    let useTabs = settings.indentType == "tabs";
    editor?.setTabsState(useTabs, tabSize);
  });

  function didLoadCurrencies() {
    editor?.didLoadCurrencies();
  }

  function restoreEditorState(noteName: string) {
    let noteMeta = getNoteMeta(noteName, false);
    let defaultPos = noteName.startsWith("scratch") ? editor.view.state.doc.length : 0;
    editor.setSelection(noteMeta?.selection, defaultPos);
    editor.setFoldedRanges(noteMeta?.foldedRanges || []);
  }

  async function saveEditorState() {
    let meta = getNoteMeta(currentNoteName, true)!;
    let didChange = false;
    let foldedRanges = editor.getFoldedRanges();
    if (!objectEqualDeep(meta.foldedRanges, foldedRanges)) {
      didChange = true;
      meta.foldedRanges = foldedRanges;
    }
    let selection = editor.getSelectionJSON();
    if (!objectEqualDeep(meta.selection, selection)) {
      didChange = true;
      meta.selection = selection;
    }
    if (didChange) {
      await saveNotesMetadata();
    }
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
        if (appState.isDirty) {
          editor.save();
        }
        saveEditorState();
      }
    });

    window.document.addEventListener("currenciesLoaded", didLoadCurrencies);
    // forward events dispatched from editor.js

    function onSelChange(ev: Event) {
      cursorChange(ev as SelectionChangeEvent);
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
    let fontFamily = settings.fontFamily!;
    let fontSize = settings.fontSize!;

    currentNoteName = settings.currentNoteName;
    let useTabs = settings.indentType == "tabs";
    let tabSize = settings.tabSize;

    async function saveCurrentNote(content: string) {
      await saveNote(currentNoteName, content);
    }

    function setIsDirty(dirty: boolean) {
      appState.isDirty = dirty;
    }

    editor = new MultiBlockEditor({
      element: editorRef,
      save: saveCurrentNote,
      setIsDirty: setIsDirty,
      createFindPanel: createFindPanel,
      extraKeymap: extraKeymap,
      theme: theme as "dark" | "light",
      keymap: keymap as "default" | "emacs",
      emacsMetaKey: emacsMetaKey as "meta" | "alt" | "ctrl",
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

    loadNote(currentNoteName).then((content) => {
      editor.setContent(content || "");
      // Use requestAnimationFrame to avoid race condition with scrollIntoView
      requestAnimationFrame(() => {
        restoreEditorState(currentNoteName);
        didLoadNote(currentNoteName, false);
      });
    });

    loadCurrencies();
    setInterval(loadCurrencies, 1000 * 3600 * 4);

    // if debugSyntaxTree prop is set, display syntax tree for debugging
    if (debugSyntaxTree) {
      setInterval(() => {
        function render(tree: any) {
          let lists = "";
          tree.iterate({
            enter(type: any) {
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

  export function setSpellChecking(value: boolean) {
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

  export function getEditor(): MultiBlockEditor {
    return editor;
  }

  export function focus() {
    editor.focus();
  }

  export async function openNote(name: string, skipSave = false, noPushHistory = false) {
    console.log("openNote:", name);
    if (!skipSave) {
      await editor.save();
      await saveEditorState();
    }
    currentNoteName = name;
    const content = (await loadNote(name)) || "";
    editor.setContent(content);
    // Use requestAnimationFrame to avoid race condition with scrollIntoView
    requestAnimationFrame(() => {
      restoreEditorState(name);
      didLoadNote(name, noPushHistory);
    });
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
