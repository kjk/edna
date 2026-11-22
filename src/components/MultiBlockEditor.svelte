<script lang="ts">
  import { mount, onMount, unmount } from "svelte";
  import { EditorView, type ViewUpdate } from "@codemirror/view";
  import { appState } from "../appstate.svelte";
  import { startCurrencyRefresh } from "../currency";
  import { MultiBlockEditor } from "../editor/editor";
  import { NoteLoader } from "../editor/note-loader";
  import type { KeymapSpec } from "../editor/editor";
  import type { SelectionChangeEvent } from "../editor/event";
  import { getNoteMeta, saveNotesMetadata } from "../metadata";
  import { getStorageFS, loadNote, saveNote } from "../notes";
  import { getSettings, resolveTheme } from "../settings.svelte";
  import { objectEqualDeep, throwIf } from "../util";
  import Find from "./Find.svelte";
  import { showError } from "./Toaster.svelte";

  function createFindPanel(view: EditorView) {
    const dom = document.createElement("div");
    const args = {
      target: dom,
      props: {
        view,
      },
    };
    let comp = mount(Find, args);
    const update = (update: ViewUpdate) => {
      comp.update(update);
    };
    const destroy = () => {
      unmount(comp);
    };
    return {
      dom,
      top: true,
      update,
      destroy,
    };
  }

  interface Props {
    class?: string;
    extraKeymap?: KeymapSpec;
    cursorChange: (e: SelectionChangeEvent) => void;
    docDidChange: () => void;
    didLoadNote: (name: string, noPushHistory: boolean, replaceTab: boolean) => void;
  }
  let { class: klass = "", extraKeymap, cursorChange, docDidChange, didLoadNote }: Props = $props();

  let settings = getSettings();

  let editor: MultiBlockEditor;
  // loads notes; loader.current is the note shown in the editor (saves go there)
  let loader: NoteLoader;
  let destroyed = false;
  // storage the current note was loaded from (undefined: localStorage). If
  // storage changed (e.g. notes were moved to a directory) we must not save
  // to the new storage (S-I4)
  let storageAtLoad: FileSystemDirectoryHandle | undefined;

  function storageChanged(): boolean {
    return getStorageFS() !== storageAtLoad;
  }

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
    let theme = resolveTheme(settings.theme);
    editor?.setTheme(theme);
    let keymap = settings.keymap;
    let emacsMetaKey = settings.emacsMetaKey;
    editor?.setKeymap(keymap, emacsMetaKey);
    let bracketClosing = settings.bracketClosing;
    editor?.setBracketClosing(bracketClosing);
    let showColorPreview = settings.showColorPreview;
    editor?.setColorPreview(showColorPreview);
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

  // true after selection / folds of current note were restored, so it's safe to save them
  let editorStateRestored = false;

  function restoreEditorState(noteName: string) {
    let noteMeta = getNoteMeta(noteName, false);
    let defaultPos = noteName.startsWith("scratch") ? editor.view.state.doc.length : 0;
    editor.setSelection(noteMeta?.selection, defaultPos);
    editor.setFoldedRanges(noteMeta?.foldedRanges || []);
    editorStateRestored = true;
  }

  async function saveEditorState() {
    // don't save state that wasn't restored for this note (O-I4)
    let name = loader?.current;
    if (!editorStateRestored || !name || storageChanged()) {
      return;
    }
    let meta = getNoteMeta(name, true)!;
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
    function onKeyDown(e: KeyboardEvent) {
      // prevent the default Save dialog from opening and save if dirty
      let isCtrlS = e.ctrlKey && e.key === "s";
      isCtrlS = isCtrlS || (e.metaKey && e.key === "s");
      if (isCtrlS) {
        e.preventDefault();
        if (appState.isDirty) {
          editor.save().catch((e) => showError(`Failed to save note: ${e}`));
        }
        saveEditorState();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    window.document.addEventListener("currenciesLoaded", didLoadCurrencies);
    // forward events dispatched from editor.js

    function onSelChange(ev: Event) {
      cursorChange(ev as SelectionChangeEvent);
    }
    function onDocChanged() {
      docDidChange();
    }
    editorRef.addEventListener("selectionChange", onSelChange);
    editorRef.addEventListener("docChanged", onDocChanged);

    throwIf(!settings);
    let showLineNumberGutter = settings.showLineNumberGutter;
    let keymap = settings.keymap;
    let emacsMetaKey = settings.emacsMetaKey;
    let showFoldGutter = settings.showFoldGutter;
    let bracketClosing = settings.bracketClosing;
    let fontFamily = settings.fontFamily!;
    let fontSize = settings.fontSize!;

    let noteToLoad = appState.currentNoteName!;
    let useTabs = settings.indentType == "tabs";
    let tabSize = settings.tabSize;

    // note: must capture loader.current synchronously (see NoteLoader)
    function saveCurrentNote(content: string): Promise<void> {
      let name = loader.current;
      if (!name) {
        return Promise.reject(new Error("no note loaded"));
      }
      if (storageChanged()) {
        return Promise.reject(new Error(`notes storage changed, can't save '${name}'`));
      }
      return saveNote(name, content);
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
      theme: resolveTheme(settings.theme),
      keymap: keymap as "default" | "emacs",
      emacsMetaKey: emacsMetaKey as "meta" | "alt" | "ctrl",
      showLineNumberGutter: showLineNumberGutter,
      showFoldGutter: showFoldGutter,
      bracketClosing: bracketClosing,
      showColorPreview: settings.showColorPreview,
      fontFamily: fontFamily,
      fontSize: fontSize,
      tabSize: tabSize,
      useTabs: useTabs,
      // TODO: add a setting for this
      defaultBlockToken: "text",
      defaultBlockAutoDetect: true,
    });

    loader = new NoteLoader({
      editor,
      loadNote,
      willShow: () => {
        editorStateRestored = false;
        storageAtLoad = getStorageFS();
      },
      loadFailed: (name, e) => {
        showError(`Failed to load note '${name}': ${e}`);
        if (loader.current === undefined) {
          // nothing loaded: don't let the user type into an empty editor
          editor.setReadOnly(true);
        }
      },
      saveFailed: (name, e) => {
        showError(`Failed to save note '${name}': ${e}`);
      },
      isDestroyed: () => destroyed,
    });
    loader.load(noteToLoad, false, () => {
      restoreEditorState(noteToLoad);
      didLoadNote(noteToLoad, false, false);
    });

    startCurrencyRefresh();

    return () => {
      destroyed = true;
      // save selection and folds when switching to Home tab, closing the tab etc.
      // note: reads editor state synchronously, before the editor is destroyed
      saveEditorState();
      document.removeEventListener("keydown", onKeyDown);
      window.document.removeEventListener("currenciesLoaded", didLoadCurrencies);
      editorRef.removeEventListener("selectionChange", onSelChange);
      editorRef.removeEventListener("docChanged", onDocChanged);
      editor.destroy();
    };
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

  export function getEditorView(): EditorView {
    return editor.view;
  }

  export function getEditor(): MultiBlockEditor {
    return editor;
  }

  export function focus() {
    editor.focus();
  }

  // returns true if the note was loaded and shown
  export async function openNote(name: string, skipSave = false, noPushHistory = false, replaceTab = false) {
    console.log("openNote:", name);
    if (!skipSave) {
      try {
        await editor.save();
      } catch (e) {
        // don't switch away from a note with edits we couldn't save
        showError(`Failed to save note '${loader.current}': ${e}`);
        return false;
      }
      await saveEditorState();
    }
    let res = await loader.load(name, !skipSave, () => {
      restoreEditorState(name);
      didLoadNote(name, noPushHistory, replaceTab);
    });
    return res === "shown";
  }
</script>

<div class="overflow-hidden {klass}">
  <div class="editor" bind:this={editorRef}></div>
</div>
