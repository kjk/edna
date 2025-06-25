<script>
  import { onMount } from "svelte";
  import { foldEffect, syntaxTree } from "@codemirror/language";
  import { EditorView } from "@codemirror/view";
  import debounce from "debounce";
  import { setCurrenciesLoadedCb, startLoadCurrencies } from "../currency.js";
  import { triggerCurrenciesLoaded } from "../editor/block/commands.js";
  import { EdnaEditor } from "../editor/editor.js";
  import { getNoteMeta, getNotesMetadata } from "../metadata.js";
  import {
    kScratchNoteName,
    loadCurrentNote,
    loadCurrentNoteIfOnDisk,
    loadNote,
    saveCurrentNote as saveCurrentNoteContent,
  } from "../notes.js";
  import { getSettings } from "../settings.svelte.js";
  import { rememberEditor } from "../state.js";
  import { appState } from "../state.svelte.js";
  import { len, throwIf } from "../util.js";

  /** @typedef {import("../editor/event.js").SelectionChangeEvent} SelectionChangeEvent */

  /** @type {{
    debugSyntaxTree: boolean,
    cursorChange: (e: SelectionChangeEvent) => void,
    docDidChange: () => void,
    didOpenNote: (name: string, noPushHistory: boolean) => void,
   }}*/

  let { debugSyntaxTree, cursorChange, docDidChange, didOpenNote } = $props();

  let syntaxTreeDebugContent = $state(null);
  let diskContent = $state(null);
  let settings = getSettings();
  let theme = settings.theme;

  /** @type {EdnaEditor} */
  let editor;

  /** @type {HTMLElement} */
  let editorEl;

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
  });

  onMount(mounted);

  function mounted() {
    console.log("Editor.svelte: mounted, editorEl:", editorEl);
    if (!editorEl) {
      return;
    }

    document.addEventListener("keydown", (e) => {
      // console.log(e);
      // prevent the default Save dialog from opening and save if dirty
      let isCtrlS = e.ctrlKey && e.key === "s";
      isCtrlS = isCtrlS || (e.metaKey && e.key === "s");
      if (isCtrlS) {
        e.preventDefault();
        // TODO: track isDirty state here?
        if (appState.isDirty) {
          saveForce();
        }
      }
    });

    // forward events dispatched from editor.js

    /**
     * @param {SelectionChangeEvent} ev
     */
    function onSelChange(ev) {
      cursorChange(ev);
    }
    editorEl.addEventListener("selectionChange", onSelChange);
    editorEl.addEventListener("docChanged", (e) => {
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

    // load buffer content and create editor
    loadCurrentNote().then((content) => {
      diskContent = content;
      editor = new EdnaEditor({
        element: editorEl,
        content: content,
        theme: theme,
        saveFunction: saveFunction,
        keymap: keymap,
        emacsMetaKey: emacsMetaKey,
        showLineNumberGutter: showLineNumberGutter,
        showFoldGutter: showFoldGutter,
        bracketClosing: bracketClosing,
        fontFamily: fontFamily,
        fontSize: fontSize,
        spacesPerTab: 2, // TODO: add a setting for this
      });
      rememberEditor(editor);
      setCurrenciesLoadedCb(() => {
        triggerCurrenciesLoaded(editor.view);
      });
      // intentially we delay it until we register a callback
      startLoadCurrencies();
      let settings = getSettings();
      let name = settings.currentNoteName;
      throwIf(!name);

      let noteMeta = getNoteMeta(name, false);
      let ranges = noteMeta?.foldedRanges || [];
      if (len(ranges) > 0) {
        editor.view.dispatch({
          effects: ranges.map((range) => foldEffect.of(range)),
        });
      }
      didOpenNote(name, false);
    });

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
      setCurrenciesLoadedCb(null);
    };
  }

  async function saveFunction(content) {
    if (content === diskContent) {
      console.log("saveFunction: content unchanged, skipping save");
      return;
    }
    console.log("saveFunction: saving content");
    diskContent = content;
    await saveCurrentNoteContent(content);
  }

  function saveForce() {
    console.log("saveForce");
    saveFunction(editor.getContent());
  }

  export function getBlocks() {
    return editor.getBlocks();
  }

  export function setReadOnly(value) {
    editor.setReadOnly(value);
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

  /**
   * @returns {EditorView}
   */
  export function getEditorView() {
    return editor.view;
  }

  /**
   * @returns {EdnaEditor}
   */
  export function getEditor() {
    return editor;
  }

  export function focus() {
    editor.focus();
  }

  // saving is debounced so ensure we save before opening a new note
  // TODO: we'll have a spurious save if there was a debounce, because
  // the debounce is still in progress, I think
  export async function saveCurrentNote() {
    let s = editor.getContent();
    await editor.saveFunction(s);
  }

  export function setEditorContent(content) {
    diskContent = content;
    let newState = editor.createState(content);
    editor.view.setState(newState);
  }

  /**
   * @param {string} name
   */
  export async function openNote(
    name,
    skipSave = false,
    noPushHistory = false,
  ) {
    console.log("openNote:", name);
    if (!skipSave) {
      // TODO: this is async so let's hope it works
      await saveCurrentNote();
    }
    let content = await loadNote(name);
    console.log("Editor.openNote: loaded:", name);
    editor.setTheme(theme);
    // TODO: move this logic to App.onDocChanged
    // a bit magic: sometimes we open at the beginning, sometimes at the end
    // TODO: remember selection in memory so that we can restore during a session
    setEditorContent(content);
    let pos = 0;
    if (name === kScratchNoteName) {
      pos = content.length;
    }
    editor.view.dispatch({
      selection: { anchor: pos, head: pos },
      scrollIntoView: true,
    });
    focus();
    console.log("openNote: triggering docChanged event, name:", name);
    didOpenNote(name, noPushHistory);
  }
</script>

<div class="overflow-hidden">
  <div class="editor" bind:this={editorEl}></div>
  {#if debugSyntaxTree}
    <div class="debug-syntax-tree">
      {@html syntaxTreeDebugContent}
    </div>
  {/if}
</div>

<style>
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
