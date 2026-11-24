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
  import { getStorageFS, loadNote, noteExists, saveNote, tryLoadNote } from "../notes";
  import { getSettings, resolveTheme } from "../settings.svelte";
  import { assignIfChanged, throwIf } from "../util";
  import Find from "./Find.svelte";
  import { saveOrShowError, showError, showSaveError, showWarning } from "./Toaster.svelte";

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

  // editor config that comes from settings
  function editorConfigFromSettings() {
    return {
      theme: resolveTheme(settings.theme),
      keymap: settings.keymap as "default" | "emacs",
      emacsMetaKey: settings.emacsMetaKey as "meta" | "alt" | "ctrl",
      showLineNumberGutter: settings.showLineNumberGutter,
      showFoldGutter: settings.showFoldGutter,
      bracketClosing: settings.bracketClosing,
      showColorPreview: settings.showColorPreview,
      fontFamily: settings.fontFamily!,
      fontSize: settings.fontSize!,
      tabSize: settings.tabSize,
      useTabs: settings.indentType == "tabs",
    };
  }

  $effect(() => {
    // note: read all settings before checking editor so that the effect
    // re-runs when any of them changes
    let c = editorConfigFromSettings();
    editor?.setLineNumberGutter(c.showLineNumberGutter);
    editor?.setFoldGutter(c.showFoldGutter);
    editor?.setTheme(c.theme);
    editor?.setKeymap(c.keymap, c.emacsMetaKey);
    editor?.setBracketClosing(c.bracketClosing);
    editor?.setColorPreview(c.showColorPreview);
    editor?.setFont(c.fontFamily, c.fontSize);
    editor?.setTabsState(c.useTabs, c.tabSize);
  });

  function didLoadCurrencies() {
    editor?.didLoadCurrencies();
  }

  // true after selection / folds of current note were restored, so it's safe to save them
  let editorStateRestored = false;

  function onNoteLoaded(name: string, noPushHistory: boolean, replaceTab: boolean) {
    restoreEditorState(name);
    didLoadNote(name, noPushHistory, replaceTab);
  }

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
    let foldsChanged = assignIfChanged(meta, "foldedRanges", editor.getFoldedRanges());
    let selectionChanged = assignIfChanged(meta, "selection", editor.getSelectionJSON());
    if (foldsChanged || selectionChanged) {
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
        // note: saving an unchanged note is a no-op
        saveOrShowError(saveAll);
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
    // save folds right away so they survive reloading the page (#9).
    // fold-all etc. emits many events, so coalesce them
    let foldsSaveTimer: ReturnType<typeof setTimeout> | undefined;
    // an edit was rejected because it would change a read-only block (#57).
    // At most one message per few seconds, e.g. when holding a key
    let lastReadOnlyMsg = 0;
    function onReadOnlyBlockEdit() {
      let now = Date.now();
      if (now - lastReadOnlyMsg > 3000) {
        lastReadOnlyMsg = now;
        showWarning("This block is read-only. Use 'Block: Toggle read-only' to edit it", 3000);
      }
    }
    function onFoldsChanged() {
      clearTimeout(foldsSaveTimer);
      foldsSaveTimer = setTimeout(saveEditorState, 500);
    }
    editorRef.addEventListener("selectionChange", onSelChange);
    editorRef.addEventListener("docChanged", onDocChanged);
    editorRef.addEventListener("foldsChanged", onFoldsChanged);
    editorRef.addEventListener("readOnlyBlockEdit", onReadOnlyBlockEdit);

    throwIf(!settings);
    let noteToLoad = appState.currentNoteName!;

    // note: must capture loader.current synchronously (see NoteLoader)
    function saveCurrentNote(content: string): Promise<void> {
      let name = loader.current;
      if (!name) {
        return Promise.reject(new Error("no note loaded"));
      }
      if (storageChanged()) {
        return Promise.reject(new Error(`notes storage changed, can't save '${name}'`));
      }
      // base: what we loaded / last saved, to detect changes made elsewhere
      let gen = editor.contentGen;
      return saveNote(name, content, editor.diskContent).then(async (res) => {
        if (!res.conflictName) {
          return;
        }
        showWarning(
          `Note '${name}' was changed in another tab or window. Your version was saved as '${res.conflictName}'.`,
          0,
        );
        if (loader.current === name && editor.contentGen === gen) {
          // continue editing the copy so that further saves don't overwrite the other version
          await openNote(res.conflictName, true);
        }
      });
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
      ...editorConfigFromSettings(),
      // TODO: add a setting for this
      defaultBlockToken: "text",
      defaultBlockAutoDetect: true,
    });

    loader = new NoteLoader({
      editor,
      loadNote,
      noteExists,
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
        showSaveError(e, name);
      },
      isDestroyed: () => destroyed,
    });
    loader.load(noteToLoad, false, () => onNoteLoaded(noteToLoad, false, false));

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
      editorRef.removeEventListener("foldsChanged", onFoldsChanged);
      editorRef.removeEventListener("readOnlyBlockEdit", onReadOnlyBlockEdit);
      clearTimeout(foldsSaveTimer);
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

  // if the note was changed elsewhere (e.g. in another Edna tab) and has no
  // unsaved edits here, show the new content (issue 15g)
  export async function reloadIfChangedElsewhere() {
    let name = loader?.current;
    if (!name || editor.isDirty()) {
      return;
    }
    let gen = editor.contentGen;
    let stored = await tryLoadNote(name);
    if (stored === undefined || stored === editor.diskContent) {
      return;
    }
    if (destroyed || gen !== editor.contentGen || loader.current !== name || editor.isDirty()) {
      // changed while reading
      return;
    }
    let selection = editor.getSelectionJSON();
    editor.setContent(stored);
    editor.setSelection(selection);
  }

  // saves current note and its selection / folds
  export async function saveAll() {
    await editor.save();
    await saveEditorState();
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
    let request = loader.newRequest();
    if (!skipSave) {
      // don't switch away from a note with edits we couldn't save
      if (!(await saveOrShowError(saveAll, loader.current))) {
        return false;
      }
    }
    let res = await loader.load(
      name,
      !skipSave,
      () => onNoteLoaded(name, noPushHistory, replaceTab),
      request,
    );
    return res === "shown";
  }
</script>

<div class="overflow-hidden {klass}">
  <div class="editor" bind:this={editorRef}></div>
</div>
