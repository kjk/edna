<script>
  import RenameNote from "./RenameNote.svelte";
  import History from "./History.svelte";
  import NoteSelector from "./NoteSelector.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import Editor from "./Editor.svelte";
  import Loading from "./Loading.svelte";
  import StatusBar from "./StatusBar.svelte";
  import TopNav from "./TopNav.svelte";
  import {
    onOpenSettings,
    getSettings,
    onSettingsChange,
    setSetting,
  } from "../settings";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import {
    createNewScratchNote,
    createNoteWithName,
    dbDelDirHandle,
    deleteNote,
    getNotesMetadata,
    getMetadataForNote,
    getStorageFS,
    pickAnotherDirectory,
    switchToStoringNotesOnDisk,
    kScratchNoteName,
    canDeleteNote,
    renameNote,
    isSystemNoteName,
    kDailyJournalNoteName,
    kHelpSystemNoteName,
    kReleaseNotesSystemNoteName,
    preLoadAllNotes,
  } from "../notes";
  import {
    getAltChar,
    isAltNumEvent,
    setURLHashNoReload,
    stringSizeInUtf8Bytes,
    sleep,
    throwIf,
  } from "../util";
  import Settings from "./settings/Settings.vue";
  import { getModChar } from "../../src/util";
  import ContextMenu from "@imengyu/vue3-context-menu";
  import { supportsFileSystem, openDirPicker } from "../fileutil";
  import { boot } from "../webapp-boot";
  import {
    getLanguage,
    langSupportsFormat,
    langSupportsRun,
  } from "../editor/languages";
  import { useToast, POSITION } from "vue-toastification";
  import { exportNotesToZip } from "../notes-export";

  let toastOptions = {
    // position: POSITION.TOP_RIGHT,
    timeout: 4000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    // draggable: true,
    // draggablePercent: 0.6,
    showCloseButtonOnHover: false,
    hideProgressBar: true,
    closeButton: "button",
    icon: false,
    rtl: false,
  };

  /**
   * @param {string} msg
   * @param {any} opts
   */
  function toast(msg, opts) {
    // do nothing
  }

  let initialSettings = getSettings();

  let column = $state(1);
  let development = $state(window.location.href.indexOf("dev=1") !== -1);
  let docSize = $state(0);
  let helpAnchor = $state("");
  let language = $state("plaintext");
  let languageAuto = $state(true);
  let line = $state(1);
  let noteName = $state(initialSettings.currentNoteName);
  let selectionSize = $state(0);
  let settings = $state(initialSettings);
  let showingMenu = $state(false);
  let showingLanguageSelector = $state(false);
  let showingNoteSelector = $state(false);
  let showingSettings = $state(false);
  let showingRenameNote = $state(false);
  let showingHistorySelector = $state(false);
  let theme = $state(initialSettings.theme);
  let isSpellChecking = $state(false);
  let spellcheckToastID = $state(0);
  let altChar = getAltChar();
  let loadingNoteName = $state("");

  // /** @type {import("../editor/editor").EdnaEditor} */
  // let ednaEditor = $state(null);

  /** @type {Editor} */
  let editor;

  let isShowingDialog = $derived.by(() => {
    return (
      showingHistorySelector ||
      showingLanguageSelector ||
      showingMenu ||
      showingRenameNote ||
      showingNoteSelector ||
      showingSettings
    );
  });

  let noteShortcut = $derived.by(() => {
    let name = noteName;
    let m = getMetadataForNote(name);
    if (m && m.altShortcut) {
      return `${altChar} + ${m.altShortcut}`;
    }
    return "";
  });

  let mcStyle = $derived.by(() => {
    return {
      display: showingMenu ? "block" : "none",
    };
  });

  $effect(() => {
    onSettingsChange((settings) => {
      settings = settings;
      theme = settings.theme;
      //throwIf(noteName != settings.currentNoteName, "noteName != settings.currentNoteName")
      console.log(
        `onSettingsChange callback, noteName: ${noteName}, settings.currentNoteName: ${settings.currentNoteName}, theme: ${theme}`
      );
    });
    onOpenSettings(() => {
      showingSettings = true;
    });
    getEditor().setSpellChecking(isSpellChecking);
    window.addEventListener("keydown", onKeyDown);

    window.addEventListener("beforeunload", async () => {
      logAppExit(); // TODO: not sure if this async func will complete
      await getEditor().saveCurrentNote();
    });
    logAppOpen();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  /**
   * @param {KeyboardEvent} event
   */
  function onKeyDown(event) {
    if (event.key === "Escape") {
      if (isShowingDialog) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      openHistorySelector();
      return;
    }

    // if (event.key === "F2") {
    //   console.log("F2");
    //   let undoAction = () => {
    //     console.log("undoAction")
    //   }
    //   toast({
    //     component: ToastUndo,
    //     props: {
    //       message: "F2 pressed",
    //       undoText: "Undo delete",
    //       undoAction: undoAction,
    //     },
    //   }, toastOptions)
    // }

    // TODO: can I do this better? The same keydown event that sets the Alt-N shortcut
    // in NoteSelector also seems to propagate here and immediately opens the note.
    if (!showingNoteSelector) {
      let altN = isAltNumEvent(event);
      // console.log("onKeyDown: e:", e, "altN:", altN)
      if (altN) {
        let meta = getNotesMetadata();
        for (let o of meta) {
          if (o.altShortcut == altN && o.name !== noteName) {
            // console.log("onKeyDown: opening note: ", o.name, " altN:", altN, " e:", e)
            openNote(o.name);
            event.preventDefault();
            return;
          }
        }
      }
    }

    // hack: stop Ctrl + O unless it originates from code mirror (because then it
    // triggers NoteSelector.vue)
    if (event.key == "o" && event.ctrlKey && !event.altKey && !event.shiftKey) {
      let target = /** @type {HTMLElement} */ (event.target);
      let fromCodeMirror = target && target.className.includes("cm-content");
      if (!fromCodeMirror) {
        event.preventDefault();
      }
    }
  }

  async function storeNotesOnDisk() {
    let dh = await openDirPicker(true);
    if (!dh) {
      return;
    }
    // TODO: await getEditor().saveCurrentNote() ?
    await switchToStoringNotesOnDisk(dh);
    let settings = getSettings();
    await openNote(settings.currentNoteName, true);
  }

  async function pickAnotherDirectory2() {
    let ok = await pickAnotherDirectory();
    if (!ok) {
      return;
    }
    await boot();
    await preLoadAllNotes();
  }

  function exportNotesToZipFile() {
    exportNotesToZip();
  }

  function onOpenSettings2() {
    showingSettings = true;
  }

  function onCloseSettings() {
    showingSettings = false;
    getEditor().focus();
  }

  function renameCurrentNote() {
    console.log("renameNote:");
    showingRenameNote = true;
  }

  async function deleteCurrentNote() {
    let name = noteName;
    console.log("deleteNote:", name);
    if (!canDeleteNote(name)) {
      console.log("cannot delete note:", name);
      return;
    }
    await openNote(kScratchNoteName, true);
    await deleteNote(name);
    // TODO: add a way to undo deletion of the note
    toast(`Deleted note '${name}'`, toastOptions);
    logNoteOp("noteDelete");
  }

  async function createScratchNote() {
    let name = await createNewScratchNote();
    await onOpenNote(name);
    // TODO: add a way to undo creation of the note
    toast(`Created scratch note '${name}'`, toastOptions);
    logNoteOp("noteCreate");
  }

  async function switchToBrowserStorage() {
    console.log("switchToBrowserStorage(): deleting dir handle");
    await dbDelDirHandle();
    await boot();
  }

  function openNoteSelector() {
    showingNoteSelector = true;
  }

  function openLanguageSelector() {
    showingLanguageSelector = true;
  }

  function oncontextmenu() {
    // TODO: implement me
  }

  function throwNYI() {
    throw new Error("NYI");
  }

  /**
   * @returns {Editor}
   */
  function getEditor() {
    return editor;
  }

  function formatCurrentBlock() {
    getEditor().formatCurrentBlock();
    logNoteOp("noteFormatBlock");
  }

  function runCurrentBlock() {
    getEditor().runCurrentBlock();
    logNoteOp("noteRunBlock");
  }

  function toggleSpellCheck() {
    isSpellChecking = !isSpellChecking;
    getEditor().setSpellChecking(isSpellChecking);
    if (isSpellChecking) {
      toast(
        "Press Shift + right mouse click for context menu when spell checking is enabled",
        toastOptions
      );
    }
  }

  /**
   * @param {string} anchor
   */
  function showHelp(anchor = "") {
    // let uri = window.location.origin + "/help"
    let uri = "/help";
    if (anchor != "") {
      uri += anchor;
    }
    window.open(uri, "_blank");
  }

  function onCloseRename() {
    showingRenameNote = false;
    getEditor().focus();
  }

  async function onRename(newName) {
    showingRenameNote = false;
    let s = getEditor().getContent() || "";
    await renameNote(noteName, newName, s);
    await openNote(newName, true);
    console.log("onRename: newName:", newName);
  }

  function openHistorySelector() {
    showingHistorySelector = true;
  }

  function closeHistorySelector() {
    showingHistorySelector = false;
    getEditor().focus();
  }

  function onSelectHistory(name) {
    showingHistorySelector = false;
    console.log("onSelectHistory:", name);
    openNote(name);
  }

  function onSelectLanguage(language) {
    showingLanguageSelector = false;
    getEditor().setLanguage(language);
  }

  function closeLanguageSelector() {
    showingLanguageSelector = false;
    getEditor().focus();
  }

  function closeNoteSelector() {
    showingNoteSelector = false;
    getEditor().focus();
  }

  async function openNote(name, skipSave = false) {
    console.log("App.openNote:", name);
    let editor = getEditor();
    editor.setReadOnly(true);
    loadingNoteName = name;
    await editor.openNote(name, skipSave);
    // await sleep(400);
    loadingNoteName = "";
    editor.focus();
  }

  /**
   * @param {string} name
   */
  function onOpenNote(name) {
    showingNoteSelector = false;
    openNote(name);
  }

  /**
   * @param {string} name
   */
  async function onCreateNote(name) {
    showingNoteSelector = false;
    await createNoteWithName(name);
    openNote(name);
    // TODO: add a way to undo creation of the note
    toast(`Created note '${name}'`, toastOptions);
    logNoteOp("noteCreate");
  }

  /**
   * @param {string} name
   */
  async function onDeleteNote(name) {
    showingNoteSelector = false;
    let settings = getSettings();
    // if deleting current note, first switch to scratch note
    // TODO: maybe switch to the most recently opened
    if (name === settings.currentNoteName) {
      console.log("deleted current note, opening scratch note");
      await openNote(kScratchNoteName);
    }
    // must delete after openNote() because openNote() saves
    // current note
    await deleteNote(name);
    getEditor().focus();
    console.log("deleted note", name);
    // TODO: add a way to undo deletion of the note
    toast(`Deleted note '${name}'`, toastOptions);
    logNoteOp("noteDelete");
  }

  /** @typedef {import("../editor/event.js").SelectionChangeEvent} SelectionChangeEvent */

  /**
   * @param {SelectionChangeEvent} e
   */
  function onCursorChange(e) {
    line = e.cursorLine.line;
    column = e.cursorLine.col;
    selectionSize = e.selectionSize;
    language = e.language;
    languageAuto = e.languageAuto;
  }

  function showHelpAsNote() {
    openNote(kHelpSystemNoteName);
  }

  function showReleaseNotes() {
    openNote(kReleaseNotesSystemNoteName);
  }

  function updateDocSize() {
    let editor = getEditor();
    const c = editor.getContent() || "";
    docSize = stringSizeInUtf8Bytes(c);
  }

  /**
   * @param {string} name
   */
  function didOpenNote(name) {
    console.log("didOpenNote:", name);
    throwIf(!name);
    noteName = name;
    console.log("onDocChanged: just opened");
    let readOnly = isSystemNoteName(name);
    editor.setReadOnly(readOnly);
    if (name === kDailyJournalNoteName) {
      console.log("journal, so going to next block");
      // editor.gotoNextBlock();
    }

    window.document.title = name;
    setURLHashNoReload(name);
    setSetting("currentNoteName", name);
    updateDocSize();
  }

  function docDidChange() {
    updateDocSize();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="grid w-screen max-h-screen h-screen fixed grid-rows-[1fr_auto]"
  {oncontextmenu}
>
  <TopNav {noteName} shortcut={noteShortcut} {openNoteSelector} />
  <Editor
    cursorChange={onCursorChange}
    {theme}
    {development}
    debugSyntaxTree={false}
    keymap={settings.keymap}
    emacsMetaKey={settings.emacsMetaKey}
    showLineNumberGutter={settings.showLineNumberGutter}
    showFoldGutter={settings.showFoldGutter}
    bracketClosing={settings.bracketClosing}
    fontFamily={settings.fontFamily}
    fontSize={settings.fontSize}
    bind:this={editor}
    {openLanguageSelector}
    {openHistorySelector}
    createNewScratchNote={createScratchNote}
    {openNoteSelector}
    {didOpenNote}
    {docDidChange}
  />
  <StatusBar
    shortcut={noteShortcut}
    {noteName}
    {line}
    {column}
    {docSize}
    {selectionSize}
    {language}
    {languageAuto}
    {isSpellChecking}
    {openLanguageSelector}
    {openNoteSelector}
    {formatCurrentBlock}
    {runCurrentBlock}
    {toggleSpellCheck}
    openSettings={onOpenSettings2}
  />
</div>
<div class="overlay">
  {#if showingNoteSelector}
    <NoteSelector
      openNote={onOpenNote}
      createNote={onCreateNote}
      deleteNote={onDeleteNote}
      close={closeNoteSelector}
    />
  {/if}

  {#if showingLanguageSelector}
    <LanguageSelector
      selectLanguage={onSelectLanguage}
      close={closeLanguageSelector}
    />
  {/if}
  {#if showingHistorySelector}
    <History close={closeHistorySelector} selectHistory={onSelectHistory} />
  {/if}
</div>

{#if loadingNoteName}
  <Loading {loadingNoteName} />
{/if}

{#if showingRenameNote}
  <RenameNote close={onCloseRename} rename={onRename} oldName={noteName} />
{/if}