<script lang="ts">
  import { tick } from "svelte";
  import debounce from "debounce";
  import { toggleBlockComment, toggleComment, toggleLineComment } from "@codemirror/commands";
  import { foldCode, unfoldCode } from "@codemirror/language";
  import { openSearchPanel, searchPanelOpen } from "@codemirror/search";
  import { EditorState } from "@codemirror/state";
  import type { EditorView } from "@codemirror/view";
  import { appState, appStateUpdateAfterNotesChange } from "../appstate.svelte";
  import {
    blockHdrMarkdown,
    isTabHome,
    kBuiltInFunctionsNoteName,
    kDailyJournalNoteName,
    kEdnaFileExt,
    kHelpSystemNoteName,
    kMyFunctionsNoteName,
    kReleaseNotesSystemNoteName,
    kScratchNoteName,
    kTabHome,
    kWelcomeDevSystemNoteName,
    kWelcomeSystemNoteName,
  } from "../constants";
  import {
    getActiveNoteBlock,
    getBlockN,
    blockContentText,
    getBlocksInfo,
    getEditableActiveBlock,
    insertAfterActiveBlock,
    insertBlockAt,
    replaceBlockContent,
  } from "../editor/block/block";
  import type { NoteBlock } from "../editor/block/block-parsing";
  import {
    addNewBlockAfterCurrent,
    addNewBlockAfterLastAndScrollDown,
    addNewBlockBeforeCurrent,
    addNewBlockBeforeFirst,
    changeCurrentBlockLanguage,
    deleteBlock,
    gotoBlock,
    gotoNextBlock,
    gotoPreviousBlock,
    insertNewBlockAtCursor,
    moveCurrentBlockDown,
    moveCurrentBlockUp,
    moveLineDown,
    moveLineUp,
    selectAll,
  } from "../editor/block/commands";
  import { transposeChars } from "../editor/block/transpose-chars";
  import { getCurrentSelection, hasSelection, isReadOnly } from "../editor/cmutils";
  import { insertDateAndTime, insertTime } from "../editor/date-time";
  import { MultiBlockEditor } from "../editor/editor";
  import type { KeymapSpec } from "../editor/editor";
  import type { SelectionChangeEvent } from "../editor/event";
  import { toggleCheckbox } from "../editor/todo-checkbox";
  import {
    foldAllBlocks,
    foldBlock,
    toggleBlockFold,
    unfoldAlBlocks,
    unfoldBlock,
    unfoldEverything,
  } from "../editor/fold-gutter";
  import { extForLang, getLanguage, langSupportsFormat, langSupportsRun } from "../editor/languages";
  import { setDefaultFontFamilyAndSize } from "../editor/theme/font-theme";
  import { toFileName } from "../filenamify";
  import { fsFileHandleWrite, hasHandlePermission, openDirPicker, supportsFileSystem } from "../fileutil";
  import { formatBlockContent } from "../format-code";
  import { boopFunctionResult, parseUserFunctions, runBoopFunction } from "../functions";
  import type { BoopFunction, BoopFunctionArg } from "../functions";
  import { askPassword, askUser, clearGlobalFuncs, setGlobalFuncs, type PasswordPromptProps } from "../globals";
  import { addNoteToHistory } from "../history";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import { hasOtherInstances, startInstanceDetection } from "../instances";
  import { boot, switchToBrowserStorage, switchToDirectory } from "../main";
  import {
    archiveNote,
    getNoteMeta,
    getNotesMetadata,
    isNoteArchived,
    toggleNoteStarred,
    unArchiveNote,
  } from "../metadata";
  import { isMoving } from "../mouse-track.svelte";
  import { blockLanguageSupportsRun, smartRunAction } from "../smart-run";
  import {
    appendToNote,
    canDeleteNote,
    createIfNotExists,
    createNewScratchNote,
    createNoteWithName,
    debugRemoveLocalStorageNotes,
    decryptAllNotes,
    deleteNote,
    encryptAllNotes,
    ensureBlockHeader,
    hasEncryptedNotes,
    hasUnencryptedNotes,
    PasswordCancelledError,
    getStorageFS,
    isNoteArchivable,
    isProtectedNote,
    isSystemNoteName,
    loadNote,
    loadNoteIfExists,
    noteExists,
    rememberOpenedNote,
    renameNote,
    switchToStoringNotesOnDisk,
  } from "../notes";
  import { browserDownloadBlob, exportNotesToZip } from "../notes-export";
  import { evalResultToString, runGo, runJS, runJSWithArg } from "../run";
  import type { CapturingEval } from "../run";
  import {
    getSettings,
    kDefaultFontFamily,
    kDefaultFontSize,
    settingsAddTab,
    settingsRemoveTab,
  } from "../settings.svelte";
  import { getMyFunctionsNote } from "../system-notes";
  import {
    addHomeToBrowserHistory,
    addNoteToBrowserHistory,
    html,
    formatDateYYYYMMDDDay,
    getClipboardText,
    isAltNumEvent,
    isDev,
    isModKey,
    keySpecMatches,
    len,
    noOp,
    arrayReplace,
    platform,
    SerialQueue,
    stringSizeInUtf8Bytes,
    throwIf,
    toggleFlag,
    trimPrefix,
    trimSuffix,
  } from "../util";
  import AskAI from "./AskAI.svelte";
  import AskFileWritePermissions from "./AskFileWritePermissions.svelte";
  import BlockSelector from "./BlockSelector.svelte";
  import type { Item as BlockItem } from "./BlockSelector.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import CreateNewNote from "./CreateNewNote.svelte";
  import PasswordPrompt from "./PasswordPrompt.svelte";
  import EnterEncryptPassword from "./EnterEncryptPassword.svelte";
  import { closeFindPanel } from "./Find.svelte";
  import FindInNotes from "./FindInNotes.svelte";
  import FunctionSelector from "./FunctionSelector.svelte";
  import HomePage from "./HomePage.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import Menu, {
    kMenuIdJustText,
    kMenuSeparator,
    kMenuStatusDisabled,
    kMenuStatusNormal,
    kMenuStatusRemoved,
  } from "./Menu.svelte";
  import type { Command, MenuDef } from "./Menu.svelte";
  import ModalMessage, { clearModalMessage, modalMessageState, showModalMessageHTML } from "./ModalMessage.svelte";
  import Editor from "./MultiBlockEditor.svelte";
  import NoteSelector from "./NoteSelector.svelte";
  import NoteSelectorWide from "./NoteSelectorWide.svelte";
  import Overlay from "./Overlay.svelte";
  import QuickAccess from "./QuickAccess.svelte";
  import RenameNote from "./RenameNote.svelte";
  import Settings from "./Settings.svelte";
  import Sidebar from "./Sidebar.svelte";
  import StatusBar from "./StatusBar.svelte";
  import Toaster, { saveOrShowError, showError, showToast, showWarning } from "./Toaster.svelte";
  import TopNav from "./TopNav.svelte";

  const isMac = platform.isMac;

  // Initialize default font settings for the editor module
  setDefaultFontFamilyAndSize(kDefaultFontFamily, kDefaultFontSize);

  let settings = getSettings();

  let column = $state(1);
  let docSize = $state(0);
  let language = $state("text");
  let languageAuto = $state(true);
  let line = $state(1);
  let noteName = $derived(appState.currentNoteName);
  let selectionSize = $state(0);

  let showingBlockSelector = $state(false);
  // dialogs closed by closeDialogs()
  const kClosableDialogs = [
    "showingContextMenu",
    "showingLanguageSelector",
    "showingNoteSelector",
    "showingBlockMoveSelector",
    "showingCommandPalette",
    "showingCreateNewNote",
    "showingFunctionSelector",
    "showingSettings",
    "showingRenameNote",
    "showingQuickAccess",
    "showingFindInNotes",
    "showingAskAI",
  ] as const;
  // dialogs waiting for an answer: not closed by closeDialogs()
  const kAnswerDialogs = ["showingDecryptPassword", "showingEncryptPassword", "showingAskFileWritePermissions"] as const;

  let isShowingDialog = $derived(
    showingBlockSelector || [...kClosableDialogs, ...kAnswerDialogs].some((key) => appState[key]),
  );

  function closeDialogs() {
    for (let key of kClosableDialogs) {
      appState[key] = false;
    }
    showingBlockSelector = false;

    appState.forceNewTab = false;

    if (editorComp) {
      getEditorComp().focus();
    }
  }

  let isSpellChecking = $state(false);

  let functionContext = $state("");
  let runFunctionOnSelection = false;
  let userFunctions: BoopFunction[] = $state([]); // note: $state() not needed
  let contextMenuPos = $state({ x: 0, y: 0 });

  let askAIStartText = $state("");
  // svelte-ignore non_reactive_update
  let editorComp: Editor;

  $effect(() => {
    isMoving.dialogOpen = isShowingDialog;
  });

  function openFindInNotes() {
    appState.showingFindInNotes = true;
  }

  function updateAfterNoteStateChange() {
    tick().then(() => {
      appStateUpdateAfterNotesChange();
      // re-assign tabs to redraw the state of the note in title
      settings.tabs = [...settings.tabs];
    });
  }

  let gf = {
    focusEditor: focusEditor,
    getPasswordFromUser: getPasswordFromUser,
    requestFileWritePermission: requestFileWritePermission,
    updateAfterNoteStateChange: updateAfterNoteStateChange,
  };
  setGlobalFuncs(gf);

  // shortcuts that also work without an editor (e.g. on Home tab)
  const globalKeymap: [string, () => void][] = [
    ["Mod-k", openNoteSelector],
    ["Mod-o", openNoteSelector],
    ["Mod-p", openNoteSelector],
    ["Mod-Shift-p", openCommandPalette],
    ["Mod-Shift-k", openCommandPalette],
    ["Mod-Shift-o", openCommandPalette],
    ["Mod-h", openQuickAccess],
    ["Mod-Shift-f", openFindInNotes],
  ];

  // External keymap bindings that require App-level functions
  let extraKeymap: KeymapSpec = [
    ["Alt-Shift-f", () => formatBlockContent(getEditor())],
    ["Mod-l", openLanguageSelector],
    ["Mod-e", smartRun],
    ["Alt-Shift-r", () => openFunctionSelector(false)],
    ["Mod-b", () => openBlockSelector()],
    ...globalKeymap,
  ];
  // Alt-n for create scratch note only on non-Mac (Option-n is used for accented characters on Mac)
  if (!isMac) {
    extraKeymap.push(["Alt-n", createScratchNote]);
  }

  $effect(() => {
    if (editorComp) {
      getEditorComp().setSpellChecking(isSpellChecking);
    }
  });

  function focusEditor() {
    if (!editorComp) return;
    getEditor().focus();
  }

  $effect(() => {
    // console.log("App.svelte did mount");
    // capture: true so that we get those before codemirror can process it
    window.addEventListener("keydown", onKeyDown, { capture: true });

    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      if (appState.isDirty) {
        // show a dialog that the content might be lost
        ev.preventDefault();
        // @ts-ignore
        ev.returnValue = true;
      } else {
        logAppExit();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const onPopState = (ev: PopStateEvent) => {
      let state = ev.state;
      if (!state || !state.noteName) {
        console.log("popstate: state is null or has no 'noteName' field:", state);
        return;
      }
      let name = state.noteName;
      console.log("popstate:", name, state);
      if (isTabHome(name)) {
        if (isShowingDialog) {
          closeDialogs();
        }
        settings.currentTab = kTabHome;
        return;
      }
      if (name === noteName) {
        console.log("same as noteName, nothing to do");
        return;
      }
      if (!noteExists(name)) {
        console.log(`Note with name '${name}' doesn't exist`);
        return;
      }
      // dialogs act on the current note (G-I2) so close them before switching
      if (isShowingDialog) {
        closeDialogs();
      }
      // like opening a note: replace the current tab instead of adding one
      openNote(name, false, true /* noPushHistory */, true /* replaceTab */);
    };
    window.addEventListener("popstate", onPopState);

    // the note might have been changed in another tab / window
    const onWindowFocus = () => {
      editorComp?.reloadIfChangedElsewhere();
    };
    window.addEventListener("focus", onWindowFocus);

    logAppOpen();

    startInstanceDetection();
    hasOtherInstances().then((yes) => {
      if (yes) {
        showWarning(
          "Edna is already open in another tab or window. Editing notes in more than one place can overwrite changes.",
          0,
        );
      }
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("focus", onWindowFocus);
      // App's functions must not be used after it's unmounted
      clearGlobalFuncs(gf);
    };
  });

  function onKeyDown(ev: KeyboardEvent) {
    let mod = isModKey(ev);

    // we bind Mod-h in CodeMirror which only works if CodeMirror has
    // focus. We have to prevent it here to disable the default
    // behavior of hiding a window
    if (ev.key == "h" && mod) {
      if (isShowingDialog) {
        ev.preventDefault();
        if (appState.showingQuickAccess) {
          appState.showingQuickAccess = false;
          focusEditor();
        }
        return;
      }
      if (editorComp) {
        return;
      }
      // no editor (e.g. Home tab): handled below
    }
    if (ev.key === "Escape") {
      // console.log("Esc");
      if (isShowingDialog) {
        return;
      }
      // don't process if codemirror is showing search panel
      let view = getEditorView();
      if (view && searchPanelOpen(view.state)) {
        console.log("closing search panel on ESC");
        closeFindPanel(view);
        return;
      }
      return;
    }

    // When there's no editor (e.g. Home tab), handle shortcuts that are
    // normally bound through CodeMirror's extraKeymap
    if (!editorComp && !isShowingDialog) {
      for (let [spec, run] of globalKeymap) {
        if (keySpecMatches(spec, ev)) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          run();
          return;
        }
      }
    }

    // Alt + 1..9 opens a note with that shortcut. Not while a dialog is open
    // (other than quick access which shows the shortcuts): dialogs act on the
    // current note (G-I2) and some (note selectors) use Alt + N themselves
    if (!isShowingDialog || appState.showingQuickAccess) {
      let altN = isAltNumEvent(ev);
      // console.log("onKeyDown: ev:", ev, "altN:", altN);
      if (altN) {
        let notes = getNotesMetadata();
        for (let note of notes) {
          if (note.altShortcut == altN && note.name !== noteName) {
            // console.log("onKeyDown: opening note: ", o.name, " altN:", altN, " e:", e)
            openNote(note.name);
            appState.showingQuickAccess = false;
            ev.preventDefault();
            return;
          }
        }
      }
    }

    // hack: stop Ctrl + O unless it originates from code mirror (because then it
    // triggers NoteSelector)
    if (ev.key == "o" && ev.ctrlKey && !ev.altKey && !ev.shiftKey) {
      let target = ev.target as HTMLElement;
      let fromCodeMirror = target && target.className.includes("cm-content");
      if (!fromCodeMirror) {
        ev.preventDefault();
      }
    }
  }

  async function storeNotesOnDisk() {
    if (!(await checkSingleInstance())) {
      return;
    }
    let dh = await openDirPicker(true);
    if (!dh) {
      return;
    }
    let ok = false;
    await runStorageOp(async () => {
      let renamed = await switchToStoringNotesOnDisk(dh);
      for (let [from, to] of renamed) {
        showWarning(`Note '${from}' already exists in the directory, moved as '${to}'`);
      }
      ok = true;
    });
    if (ok) {
      // re-load everything from the new storage
      await boot();
    }
  }

  // other Edna tabs / windows don't know about changes to how notes are stored
  // (issue 13 in docs/state-machines.md)
  async function checkSingleInstance(): Promise<boolean> {
    if (await hasOtherInstances()) {
      showWarning("Edna is open in another tab or window. Close it first.");
      return false;
    }
    return true;
  }

  // pending edits and selection / folds of the current note must be saved to
  // the current storage before switching storage (S-I4)
  async function saveBeforeStorageSwitch(): Promise<boolean> {
    if (!editorComp) {
      return true;
    }
    return saveOrShowError(() => editorComp.saveAll());
  }

  // only one Edna instance can switch storage, after saving the current note
  async function canSwitchStorage(): Promise<boolean> {
    return (await checkSingleInstance()) && (await saveBeforeStorageSwitch());
  }

  // runs a storage switch if only this instance is running and the current note was saved
  async function switchStorage(doSwitch: () => Promise<void>) {
    if (await canSwitchStorage()) {
      await doSwitch();
    }
  }

  let passwordPrompt: PasswordPromptProps | undefined = $state();

  function getPasswordFromUser(msg: string = ""): Promise<string> {
    return askPassword(
      msg,
      (props) => {
        passwordPrompt = props;
        appState.showingDecryptPassword = true;
      },
      () => (appState.showingDecryptPassword = false),
    );
  }

  let fileWritePermissionsFileHandle: FileSystemFileHandle | undefined = $state();
  let askFileWritePermissionsClose: (ok: boolean) => void = $state(noOp);

  // one permission dialog at a time: a second request waits for the first
  // instead of replacing its resolver (which would never resolve the first)
  const permissionQueue = new SerialQueue();

  function requestFileWritePermission(fh: FileSystemFileHandle): Promise<boolean> {
    return permissionQueue.run(() => requestFileWritePermissionNow(fh));
  }

  async function requestFileWritePermissionNow(fh: FileSystemFileHandle): Promise<boolean> {
    if (await hasHandlePermission(fh, true)) {
      console.log("requestFileWritePermission: already have write permissions to", fh);
      return true;
    }
    return askUser<boolean>(
      (answer) => {
        fileWritePermissionsFileHandle = fh;
        askFileWritePermissionsClose = answer;
        appState.showingAskFileWritePermissions = true;
      },
      () => (appState.showingAskFileWritePermissions = false),
    );
  }

  function openEncryptPassword() {
    appState.showingEncryptPassword = true;
  }

  // URL / history and title follow the Home tab (the URL hash names the open note)
  $effect(() => {
    if (isTabHome(settings.currentTab)) {
      addHomeToBrowserHistory(kTabHome);
      window.document.title = "Edna";
    }
  });

  function closeEncryptPassword() {
    appState.showingEncryptPassword = false;
    // note: no editor on Home tab
    focusEditor();
  }

  function onEncryptPassword(pwd: string) {
    closeEncryptPassword();
    runStorageOp(() => encryptAllNotes(pwd));
  }

  // Runs an operation that changes how / where notes are stored (encrypt,
  // decrypt, move to directory). The current note is saved first and the
  // editor is read-only while it runs so that edits can't race with it.
  async function runStorageOp(fn: () => Promise<unknown>) {
    if (!(await canSwitchStorage())) {
      return;
    }
    let editor = editorComp ? getEditor() : undefined;
    try {
      // note: editor might have been destroyed in the meantime
      await withReadOnlyEditor(editor, () => !!editorComp && getEditor() === editor, fn);
    } catch (e) {
      if (!(e instanceof PasswordCancelledError)) {
        showError(`${e}`);
      }
    }
  }

  // runs fn with editor read-only; afterwards restores its read-only state
  // if it still shows the same document (stillSame())
  async function withReadOnlyEditor<T>(
    editor: MultiBlockEditor | undefined,
    stillSame: () => boolean,
    fn: () => Promise<T>,
  ): Promise<T> {
    let wasReadOnly = editor ? isReadOnly(editor.view) : false;
    editor?.setReadOnly(true);
    try {
      return await fn();
    } finally {
      if (editor && stillSame()) {
        editor.setReadOnly(wasReadOnly);
      }
    }
  }

  function exportNotesToZipFile() {
    exportNotesToZip();
  }

  async function openNoteFromDisk() {
    if (!supportsFileSystem()) {
      return;
    }
    let opts = {
      types: [
        {
          description: "Edna notes",
          accept: {
            "application/text": [".edna.txt"],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: true,
    };
    let fileHandles = [];
    try {
      // @ts-ignore
      fileHandles = await window.showOpenFilePicker(opts);
    } catch (e) {
      console.log(e);
      return;
    }
    let noteToOpen = null;
    let skipped: string[] = [];
    for (let fh of fileHandles) {
      console.log("fh:", fh);
      let noteName = rememberOpenedNote(fh);
      if (noteName === null || noteName === "") {
        skipped.push(fh.name);
        continue;
      }
      // will open the first selected note
      if (noteToOpen === null) {
        noteToOpen = noteName;
      }
    }
    if (skipped.length > 0) {
      showWarning(`Can't open ${skipped.join(", ")}: only unencrypted .edna.txt notes with a valid name can be opened`);
    }
    if (noteToOpen) {
      openNote(noteToOpen);
    }
  }

  async function exportTextToFile(s: string, fileName: string) {
    await exportBlobToFile(new Blob([s], { type: "text/plain" }), fileName);
  }

  async function exportBlobToFile(blob: Blob, fileName: string) {
    if (!supportsFileSystem()) {
      browserDownloadBlob(blob, fileName);
      return;
    }
    let opts = {
      suggestedName: fileName,
    };
    let fh = null;
    try {
      // @ts-ignore
      fh = await window.showSaveFilePicker(opts);
    } catch (e) {
      console.log(e);
      return;
    }
    await fsFileHandleWrite(fh, blob);
  }

  async function exportCurrentBlock() {
    let editor = getEditor();
    let bi = getBlocksInfo(editor.view.state);
    let block = getActiveNoteBlock(editor.view.state)!;
    let ext = extForLang(block.language);
    let name = toFileName(noteName!) + `-${bi.active}.` + ext;
    let s = blockContentText(editor.view.state, block);
    console.log("exportCurrentBlock:", name);
    await exportTextToFile(s, name);
  }

  async function exportCurrentNote() {
    let fileName = toFileName(noteName!) + kEdnaFileExt;
    let editor = getEditor();
    let s = editor.getContent();
    console.log("exportCurrentNote:", fileName);
    await exportTextToFile(s, fileName);
  }

  function openSettings() {
    appState.showingSettings = true;
  }

  async function createScratchNote() {
    let name = await createNewScratchNote();
    await onOpenNote(name);
    didCreateNote(name, "scratch note");
  }

  // TODO: add a way to undo creation of the note
  function didCreateNote(name: string, what: string) {
    showToast(`Created ${what} '${name}'`);
    logNoteOp("noteCreate");
  }

  function extractBlockTitle(c: string, from: number, to: number): string {
    let s = c.substring(from, to);
    s = s.trim();
    let idx = s.indexOf("\n");
    if (idx > 0) {
      s = s.substring(0, idx);
    }
    // trim "#" at the beginning for markdown nodes
    while (s[0] === "#") {
      s = s.substring(1);
    }
    s = s.trim();

    // trim /* cmments
    s = trimPrefix(s, "/*");
    s = trimSuffix(s, "*/");
    s = s.trim();

    // trim "//" comments
    while (s[0] === "/") {
      s = s.substring(1);
    }
    s = s.trim();

    // trim html comments <!--, -->
    s = trimPrefix(s, "<!--");
    s = trimSuffix(s, "-->");
    s = s.trim();

    if (len(s) === 0) {
      return "(empty)";
    }
    return s;
  }

  let blockItems: BlockItem[] = $state([]);
  let initialBlockSelection = $state(0);

  function openBlockSelector(fn = selectBlock) {
    console.log("openBlockSelector");
    fnSelectBlock = fn;
    let editor = getEditor();
    let { blocks, active } = getBlocksInfo(editor.view.state);
    let content = editor.getContent();
    blockItems = blocks.map((b): BlockItem => ({
      block: b,
      text: extractBlockTitle(content, b.contentFrom, b.to),
    }));
    initialBlockSelection = active;
    showingBlockSelector = true;
  }

  function openCreateNewNote() {
    appState.showingCreateNewNote = true;
  }

  function selectBlock(block: NoteBlock) {
    // console.log("selectBlock", $state.snapshot(blockItem));
    let view = getEditorView();
    gotoBlock(view, block.index);
    closeDialogs();
  }

  function switchToNoteSelector() {
    appState.showingCommandPalette = false;
    openNoteSelector();
  }

  function switchToCommandPalette() {
    appState.showingNoteSelector = false;
    // forceNewTab only applies to the note selector (G-I3)
    appState.forceNewTab = false;
    openCommandPalette();
  }

  function openNoteSelector() {
    appState.showingNoteSelector = true;
  }

  function openNoteSelectorInNewTab() {
    appState.forceNewTab = true;
    openNoteSelector();
  }

  function reOpenNoteSelector() {
    appState.showingNoteSelector = false;
    tick().then(() => {
      appState.showingNoteSelector = true;
    });
  }

  function setUseWideSelectors(wide: boolean) {
    settings.useWideSelectors = wide;
    reOpenNoteSelector();
  }

  async function openFunctionSelector(onSelection = false) {
    console.log("openFunctionSelector");
    if (onSelection) {
      runFunctionOnSelection = true;
      functionContext = "selection";
    } else {
      runFunctionOnSelection = false;
      functionContext = "content of current block";
    }
    let userFunctionsStr = await loadNoteIfExists(kMyFunctionsNoteName);
    if (!userFunctionsStr) {
      userFunctions = [];
    } else {
      userFunctions = parseUserFunctions(userFunctionsStr);
    }
    if (isShowingDialog || !editorComp) {
      // another dialog was opened (or the editor closed) while loading (G-I1)
      return;
    }
    appState.showingFunctionSelector = true;
  }

  // state machine M9 in docs/state-machines.md: at most one run at a time (R-I1),
  // output goes to the note the run started in (R-I2), a run always ends (R-I3)
  let runInProgress = false;

  interface RunContext {
    editor: MultiBlockEditor;
    contentGen: number; // identifies the document shown in the editor
    note: string;
    wasReadOnly: boolean;
  }

  // runs fn with the editor read-only (so the document doesn't change while
  // code runs). Returns undefined if a run is already in progress
  async function withRun<T>(editor: MultiBlockEditor, fn: (run: RunContext) => Promise<T>): Promise<T | undefined> {
    if (runInProgress) {
      showWarning("Code is already running");
      return;
    }
    runInProgress = true;
    let run: RunContext = {
      editor,
      contentGen: editor.contentGen,
      note: noteName!,
      wasReadOnly: isReadOnly(editor.view),
    };
    try {
      return await withReadOnlyEditor(editor, () => isSameDocument(run), () => fn(run));
    } catch (e) {
      showError(`Error running code: ${e}`);
      return;
    } finally {
      runInProgress = false;
      clearModalMessage("run");
    }
  }

  // true if the editor still shows the document the run started in
  function isSameDocument(run: RunContext): boolean {
    return !!editorComp && getEditor() === run.editor && run.editor.contentGen === run.contentGen;
  }

  // inserts output (starting with a block header) after the active block, or
  // appends it to the note the run started in if the user switched notes
  async function insertRunOutput(run: RunContext, text: string) {
    if (isSameDocument(run)) {
      run.editor.setReadOnly(run.wasReadOnly);
      insertAfterActiveBlock(run.editor.view, text);
      return;
    }
    await appendToNote(run.note, text);
    showToast(`Output added to the end of note '${run.note}'`);
  }

  export async function runBoopFunctionWithText(f: BoopFunction, txt: string): Promise<BoopFunctionArg> {
    let input = {
      text: txt,
      fullText: txt,
      postInfo: (s: string) => {
        console.log("postInfo:", s);
        showToast(s, 0);
      },
      postError: (s: string) => {
        console.log("postError:", s);
        showError("Error:" + s, 0);
      },
    };
    let res = await runBoopFunction(f, input);
    console.log("res:", res);
    return input;
  }

  // note: replace is not supported because selection can cross blocks
  async function runBoopFunctionWithSelection(run: RunContext, fdef: BoopFunction): Promise<boolean> {
    let { selectedText } = getCurrentSelection(run.editor.view.state);
    const content = selectedText;
    let res = await boopResult(fdef, content);
    // TODO: be more intelligent
    if (res === "" || res === content) {
      return false;
    }
    await insertRunOutputBlock(run, res);
    return true;
  }

  // result of running boop function fdef on content, or an error message
  async function boopResult(fdef: BoopFunction, content: string): Promise<string> {
    try {
      let input = await runBoopFunctionWithText(fdef, content);
      return boopFunctionResult(input, content);
    } catch (e) {
      return `error running ${fdef.name}: ${e}`;
    }
  }

  // inserts output of a run as a new block after the block it was run from
  async function insertRunOutputBlock(run: RunContext, output: string) {
    await insertRunOutput(run, ensureBlockHeader(output));
  }

  async function runBoopFunctionWithBlockContent(run: RunContext, fdef: BoopFunction, replace: boolean): Promise<boolean> {
    const view = run.editor.view;
    const { state } = view;
    const block = getActiveNoteBlock(state)!;
    const cursorPos = state.selection.asSingle().ranges[0]!.head;
    const content = blockContentText(state, block);
    let res = await boopResult(fdef, content);

    // block offsets are only valid if it's still the same document (the editor
    // is read-only while running so it can't be edited)
    if (replace && isSameDocument(run)) {
      run.editor.setReadOnly(run.wasReadOnly);
      replaceBlockContent(view, block, res, cursorPos - block.contentFrom, { userEvent: "input" });
      return true;
    }
    await insertRunOutputBlock(run, res);
    return true;
  }

  async function runFunction(fdef: BoopFunction, replace: boolean) {
    appState.showingFunctionSelector = false;
    let view = getEditorView();
    if (isReadOnly(view)) {
      view.focus();
      return;
    }
    let onSelection = runFunctionOnSelection;
    await withRun(getEditor(), async (run) => {
      let msg = html`Running <span class="font-bold">${fdef.name}</span>...`;
      showModalMessageHTML(msg, 300, "run");
      if (onSelection) {
        await runBoopFunctionWithSelection(run, fdef);
        logNoteOp("runFunctionWithSelection");
      } else {
        await runBoopFunctionWithBlockContent(run, fdef, replace);
        logNoteOp("runFunction");
      }
    });
    focusEditor();
  }

  function openLanguageSelector() {
    appState.showingLanguageSelector = true;
  }

  function onSelectLanguage(lang: string) {
    appState.showingLanguageSelector = false;
    let view = getEditorView();
    let auto = false;
    if (lang === "auto") {
      lang = "text";
      auto = true;
    }
    changeCurrentBlockLanguage(view, lang, auto);
    view.focus();
  }

  let nextMenuID = 1000;
  function nmid() {
    nextMenuID++;
    return nextMenuID;
  }

  const kCmdCommandPalette = nmid();
  const kCmdOpenNote = nmid();
  const kCmdOpenNoteInNewTab = nmid();
  const kCmdCreateNewNote = nmid();
  const kCmdCloseCurrentTab = nmid();
  const kCmdRenameCurrentNote = nmid();
  const kCmdArchiveCurrentNote = nmid();
  const kCmdUnArchiveCurrentNote = nmid();
  const kCmdPermanentlyDeleteNote = nmid();
  const kCmdCreateScratchNote = nmid();
  const kCmdMoveLineUp = nmid();
  const kCmdMoveLineDown = nmid();
  const kCmdMoveSelectionUp = nmid();
  const kCmdMoveSelectionDown = nmid();
  const kCmdNewBlockAfterCurrent = nmid();
  const kCmdBlockFirst = kCmdNewBlockAfterCurrent;
  const kCmdGoToBlock = nmid();
  const kCmdNewBlockBeforeCurrent = nmid();
  const kCmdNewBlockAtEnd = nmid();
  const kCmdNewBlockAtStart = nmid();
  const kCmdBlockDelete = nmid();
  const kCmdSplitBlockAtCursor = nmid();
  const kCmdGoToNextBlock = nmid();
  const kCmdGoToPreviousBlock = nmid();
  const kCmdChangeBlockLanguage = nmid();
  const kCmdBlockSelectAll = nmid();
  const kCmdMoveBlock = nmid();
  const kCmdTransposeChars = nmid();
  const kCmdInsertDateAndTime = nmid();
  const kCmdInsertTime = nmid();
  const kCmdToggleBlockFold = nmid();
  const kCmdFoldBlock = nmid();
  const kCmdUnfoldBlock = nmid();
  const kCmdFoldAllBlocks = nmid();
  const kCmdUnfoldAllBlocks = nmid();
  const kCmdFoldCode = nmid();
  const kCmdUnfoldColde = nmid();
  const kCmdUnfoldEverything = nmid();
  const kCmdToggleComment = nmid();
  const kCmdToggleLineComment = nmid();
  const kCmdToggleBlockComment = nmid();
  const kCmdMoveBlockUp = nmid();
  const kCmdMoveBlockDown = nmid();
  const kCmdFormatBlock = nmid();
  const kCmdBlockLast = kCmdFormatBlock;

  const kCmdShowHelp = nmid();
  const kCmdShowHelpAsNote = nmid();
  const kCmdShowReleaseNotes = nmid();
  const kCmdMoveNotesToDirectory = nmid();
  const kCmdSwitchToNotesInDir = nmid();
  const kCmdSwitchToLocalStorage = nmid();
  const kCmdExportNotes = nmid();
  const kCmdExportCurrentNote = nmid();
  const kCmdEncryptNotes = nmid();
  const kCmdDecryptNotes = nmid();
  const kCmdEncryptionHelp = nmid();
  const kCmdToggleSpellChecking = nmid();
  const kCmdToggleCheckbox = nmid();
  const kCmdShowStorageHelp = nmid();
  const kCmdSettings = nmid();
  const kCmdOpenQuickAccess = nmid();
  const kCmdShowWelcomeNote = nmid();
  const kCmdShowWelcomeDevNote = nmid();
  const kCmdSmartRun = nmid();
  const kCmdRunBlock = nmid();
  const kCmdRunBlockWithAnotherBlock = nmid();
  const kCmdRunBlockWithClipboard = nmid();
  const kCmdRunFunctionWithBlockContent = nmid();
  const kCmdRunFunctionWithSelection = nmid();
  const kCmdCreateYourOwnFunctions = nmid();
  const kCmdShowBuiltInFunctions = nmid();
  const kCmdRunHelp = nmid();
  const kCmdExportCurrentBlock = nmid();
  const kCmdNoteToggleStarred = nmid();
  const kCmdOpenNoteFromDisk = nmid();
  const kCmdToggleSidebar = nmid();
  const kCmdFind = nmid();
  const kCmdFindInNotes = nmid();
  const kCmdSearch = nmid();
  const kCmdSearchInNotes = nmid();
  const kCmdAskAI = nmid();
  const kCmdTestErrorTracking = nmid();

  function buildStorageMenu(): Command[] {
    let dh = getStorageFS();
    let currStorage = "Current store: browser (local storage)";
    if (dh) {
      currStorage = `Current store: directory ${dh.name}`;
    }
    return [
      [currStorage, kMenuIdJustText],
      ["Move notes from browser to directory", kCmdMoveNotesToDirectory],
      ["Switch to browser (local storage)", kCmdSwitchToLocalStorage],
      ["Switch to notes in a directory", kCmdSwitchToNotesInDir],
      kMenuSeparator,
      ["Export all notes to .zip file", kCmdExportNotes],
      kMenuSeparator,
      ["Help: storage", kCmdShowStorageHelp],
    ];
  }

  function buildEncryptMenu(): Command[] {
    return [
      ["Encrypt all notes", kCmdEncryptNotes],
      ["Decrypt all notes", kCmdDecryptNotes],
      ["Help: encryption", kCmdEncryptionHelp],
    ];
  }

  function buildHelpMenu(): Command[] {
    const menuHelp: Command[] = [
      ["Show help", kCmdShowHelp],
      ["Show help as note", kCmdShowHelpAsNote],
      ["Release notes", kCmdShowReleaseNotes],
      ["Show Welcome Note", kCmdShowWelcomeNote],
    ];
    if (isDev()) {
      menuHelp.push(["Show Welcome Dev Note", kCmdShowWelcomeDevNote]);
    }
    return menuHelp;
  }

  // "Add {what}to favorites" or "Remove {what}from favorites" for the current note
  function toggleFavoriteLabel(what: string): string {
    let isStarred = !!(noteName && getNoteMeta(noteName)?.isStarred);
    return isStarred ? `Remove ${what}from favorites` : `Add ${what}to favorites`;
  }

  function buildMenuDefForEditor(): MenuDef {
    let starAction = toggleFavoriteLabel("");

    const menuNote: Command[] = [
      ["Close tab", kCmdCloseCurrentTab],
      ["Rename", kCmdRenameCurrentNote],
      [starAction, kCmdNoteToggleStarred],
      ["Archive", kCmdArchiveCurrentNote],
      ["Un-archive", kCmdUnArchiveCurrentNote],
      ["Delete permanently", kCmdPermanentlyDeleteNote],
      ["Export to file", kCmdExportCurrentNote],
    ];

    const menuBlock: Command[] = [
      ["Go To\tMod + B", kCmdGoToBlock],
      ["Add after current\tMod + Enter", kCmdNewBlockAfterCurrent],
      ["Add before current\tAlt + Enter", kCmdNewBlockBeforeCurrent],
      ["Add at end\tMod + Shift + Enter", kCmdNewBlockAtEnd],
      ["Add at start\tAlt + Shift + Enter", kCmdNewBlockAtStart],
      ["Split at cursor position\tMod + Alt + Enter", kCmdSplitBlockAtCursor],
      ["Goto next\tMod + Down", kCmdGoToNextBlock],
      ["Goto previous\tMod + Up", kCmdGoToPreviousBlock],
      ["Move up\tAlt-Mod-Shift-ArrowUp", kCmdMoveBlockUp],
      ["Move down\tAlt-Mod-Shift-ArrowDown", kCmdMoveBlockDown],
      ["Change language\tMod + L", kCmdChangeBlockLanguage],
      ["Select all text\tMod + A", kCmdBlockSelectAll],
      ["Format as " + language + "\tAlt + Shift + F", kCmdFormatBlock],
      ["Export to file", kCmdExportCurrentBlock],
      ["Delete", kCmdBlockDelete],
      ["Move to another note", kCmdMoveBlock],
      ["Toggle block fold\tMod + Alt + .", kCmdToggleBlockFold],
      ["Fold block\tMod + Alt + [", kCmdFoldBlock],
      ["Unfold block\tMod + Alt + ]", kCmdUnfoldBlock],
    ];

    const menuRun: Command[] = [
      ["Smart Run\tMod + E", kCmdSmartRun],
      ["Run this block", kCmdRunBlock],
      ["Run this block with another block", kCmdRunBlockWithAnotherBlock],
      ["Run this block with clipboard", kCmdRunBlockWithClipboard],
      ["Run function with this block\tAlt + Shift + R", kCmdRunFunctionWithBlockContent],
      ["Run function with selection", kCmdRunFunctionWithSelection],
      ["Show built-in functions", kCmdShowBuiltInFunctions],
      ["Create your own functions", kCmdCreateYourOwnFunctions],
      ["Help", kCmdRunHelp],
    ];

    return buildTopLevelMenu([
      ["Ask AI", kCmdAskAI],
      ["This note", menuNote],
      ["Block", menuBlock],
      ["Run code", menuRun],
    ]);
  }

  // menu items shared by editor and home page menus, with editorItems in the middle
  function buildTopLevelMenu(editorItems: MenuDef): MenuDef {
    const menu: MenuDef = [
      ["Command Palette\tMod + Shift + K", kCmdCommandPalette],
      ["Open note\tMod + K", kCmdOpenNote],
      ["New note", kCmdCreateNewNote],
      ...editorItems,
      ["Notes storage", buildStorageMenu()],
    ];
    if (getStorageFS()) {
      // encryption only for files stored on disk
      menu.push(["Encryption", buildEncryptMenu()]);
    }
    menu.push(
      ["Settings", kCmdSettings],
      ["Help", buildHelpMenu()],
      ["Tip: Ctrl + click for browser's context menu", kMenuIdJustText],
    );
    return menu;
  }

  function buildMenuDefHomePage(): MenuDef {
    return buildTopLevelMenu([]);
  }

  function buildMenuDef(): MenuDef {
    if (isTabHome(settings.currentTab)) {
      return buildMenuDefHomePage();
    }
    return buildMenuDefForEditor();
  }

  const commandNameOverrides = [
    kCmdRenameCurrentNote,
    "Rename current note",
    kCmdPermanentlyDeleteNote,
    "Delete note permanently",
    kCmdExportCurrentNote,
    "Export current note to a file",
    kCmdExportCurrentBlock,
    "Export current block to a file",
    kCmdShowStorageHelp,
    "Help: storage",
    kCmdRunHelp,
    "Help: running code",
    kCmdShowHelp,
    "Help",
    kCmdShowHelpAsNote,
    "Help as note",
    kCmdCloseCurrentTab,
    "Close tab",
    kCmdArchiveCurrentNote,
    "Archive note",
    kCmdUnArchiveCurrentNote,
    "Un-archive note",
  ];

  const commandPaletteAdditions: Command[] = [
    ...(isDev() ? [["Test error tracking", kCmdTestErrorTracking] as Command] : []),
    ["Create New Scratch Note", kCmdCreateScratchNote],
    // ["Create New Note", kCmdCreateNewNote],
    ["Open recent note", kCmdOpenQuickAccess],
    ["Open note in new tab", kCmdOpenNoteInNewTab],
    ["Toggle Sidebar", kCmdToggleSidebar],
    ["Find", kCmdFind],
    ["Find in notes", kCmdFindInNotes],
    ["Search", kCmdSearch],
    ["Search in notes", kCmdSearchInNotes],
    ["Open note from disk", kCmdOpenNoteFromDisk],
    ["Block: Fold all blocks", kCmdFoldAllBlocks],
    ["Block: Unfold all blocks", kCmdUnfoldAllBlocks],
    ["Edit: Transpose chars", kCmdTransposeChars],
    ["Edit: Move line up\tAlt-ArrowUp", kCmdMoveLineUp],
    ["Edit: Move line down\tAlt-ArrowDown", kCmdMoveLineDown],
    ["Edit: Move selection up\tAlt-ArrowUp", kCmdMoveSelectionUp],
    ["Edit: Move selection down\tAlt-ArrowDown", kCmdMoveSelectionDown],
    ["Edit: Insert date\tAlt-Shift-d", kCmdInsertDateAndTime],
    ["Edit: Insert time\tAlt-Shift-t", kCmdInsertTime],
    ["Edit: Unfold everything", kCmdUnfoldEverything],
    ["Edit: Toggle comment\tMod-/", kCmdToggleComment],
    ["Edit: Toggle line comment", kCmdToggleLineComment],
    ["Edit: Toggle block comment\tAlt-Shift-a", kCmdToggleBlockComment],
    ["Edit: Toggle todo checkbox\tMod-Shift-Space", kCmdToggleCheckbox],
    // ["Export current note", kCmdExportCurrentNote],
    ["Edit: Fold code\tMod-Shift-[", kCmdFoldCode],
    ["Edit: Unfold code\tMod-Shift-]", kCmdUnfoldColde],
  ];

  // commands that work when there's no editor (e.g. on Home tab)
  const cmdsWithoutEditor = [
    kCmdCommandPalette,
    kCmdOpenNote,
    kCmdOpenNoteInNewTab,
    kCmdCreateNewNote,
    kCmdCreateScratchNote,
    kCmdShowHelp,
    kCmdShowHelpAsNote,
    kCmdShowReleaseNotes,
    kCmdMoveNotesToDirectory,
    kCmdSwitchToNotesInDir,
    kCmdSwitchToLocalStorage,
    kCmdExportNotes,
    kCmdEncryptNotes,
    kCmdDecryptNotes,
    kCmdEncryptionHelp,
    kCmdShowStorageHelp,
    kCmdSettings,
    kCmdOpenQuickAccess,
    kCmdShowWelcomeNote,
    kCmdShowWelcomeDevNote,
    kCmdCreateYourOwnFunctions,
    kCmdShowBuiltInFunctions,
    kCmdRunHelp,
    kCmdOpenNoteFromDisk,
    kCmdToggleSidebar,
    kCmdFindInNotes,
    kCmdSearchInNotes,
    kCmdTestErrorTracking,
  ];

  function menuItemStatus(mi: Command): number {
    if (Array.isArray(mi[1])) {
      // submenu: its items have their own status (U15)
      return kMenuStatusNormal;
    }
    let mid = mi[1];
    if (mid === kMenuIdJustText) {
      return kMenuStatusDisabled;
    }
    if (!editorComp && !cmdsWithoutEditor.includes(mid)) {
      return kMenuStatusRemoved;
    }
    let noteName = appState.currentNoteName || "";
    // console.log("menuItemStatus:", mi);
    // console.log("s:", s, "mid:", mid);
    // note: this is called for each menu item so should be fast
    // undefined for an unknown block language (U12)
    let lang = getLanguage(language);
    let dh = getStorageFS();
    // console.log("dh:", dh);
    let hasFS = supportsFileSystem();
    let view = getEditorView();
    let readOnly = view ? isReadOnly(view) : true;
    let hasSel = view ? editorHasSelection() : false;

    let removeIfReadOnly = [
      kCmdFormatBlock,
      kCmdToggleBlockFold,
      kCmdFoldBlock,
      kCmdUnfoldBlock,
      kCmdFoldAllBlocks,
      kCmdUnfoldAllBlocks,
      kCmdUnfoldEverything,
      kCmdFoldCode,
      kCmdUnfoldColde,
      kCmdMoveBlock, // disable?
      kCmdRunBlock, // disable?
      kCmdRunBlockWithAnotherBlock, // disable?
      kCmdRunBlockWithClipboard, // disable?
      kCmdSmartRun, // disable?
      kCmdRunFunctionWithBlockContent, // disable?
      kCmdRunFunctionWithSelection, // disable?
      kCmdTransposeChars,
      kCmdToggleComment,
      kCmdToggleLineComment,
      kCmdToggleBlockComment,
      kCmdToggleCheckbox,
      kCmdMoveLineUp,
      kCmdMoveLineDown,
      kCmdMoveSelectionUp,
      kCmdMoveSelectionDown,
    ];
    let removedfNeedsFS = [
      kCmdOpenNoteFromDisk,
      kCmdMoveNotesToDirectory,
      kCmdSwitchToLocalStorage,
      kCmdSwitchToNotesInDir,
    ];

    if (readOnly && removeIfReadOnly.includes(mid)) {
      return kMenuStatusRemoved;
    }
    if (!hasFS && removedfNeedsFS.includes(mid)) {
      return kMenuStatusRemoved;
    }

    if (mid === kCmdFormatBlock) {
      if (!langSupportsFormat(lang)) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdRunBlock) {
      if (!langSupportsRun(lang)) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdRunBlockWithAnotherBlock || mid === kCmdRunBlockWithClipboard) {
      // only JavaScript functions take an argument
      if (lang?.token !== "javascript") {
        return kMenuStatusDisabled;
      }
      // it would be nice to check clipboard for empty text but that triggers clipboard
      // permissions dialog https://github.com/kjk/edna/issues/81
      // if (!mostRecentHasClipboardText) {
      //   return kMenuStatusDisabled;
      // }
    } else if (mid === kCmdMoveNotesToDirectory) {
      if (dh) {
        // currently using directory
        return kMenuStatusRemoved;
      }
    } else if (mid == kCmdSwitchToLocalStorage) {
      if (!dh) {
        // currently using local storage
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdEncryptNotes) {
      // also enabled when some notes are encrypted, to finish an interrupted encryption
      if (!dh) {
        return kMenuStatusRemoved;
      }
      return hasUnencryptedNotes() ? kMenuStatusNormal : kMenuStatusDisabled;
    } else if (mid === kCmdDecryptNotes) {
      if (!dh) {
        return kMenuStatusRemoved;
      }
      return hasEncryptedNotes() ? kMenuStatusNormal : kMenuStatusDisabled;
    } else if (mid === kCmdRenameCurrentNote) {
      if (isProtectedNote(noteName)) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdRunFunctionWithBlockContent || mid === kCmdRunFunctionWithSelection) {
      if (mid === kCmdRunFunctionWithSelection && !hasSel) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdMoveLineUp || mid == kCmdMoveLineDown) {
      if (hasSel) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdMoveSelectionUp || mid == kCmdMoveSelectionDown) {
      if (!hasSel) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdCloseCurrentTab) {
      if (len(settings.tabs) < 2) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdPermanentlyDeleteNote) {
      if (!canDeleteNote(noteName)) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdArchiveCurrentNote) {
      if (!isNoteArchivable(noteName) || isNoteArchived(noteName)) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdUnArchiveCurrentNote) {
      if (!isNoteArchived(noteName)) {
        return kMenuStatusRemoved;
      }
    }
    return kMenuStatusNormal;
  }

  function editorHasSelection(): boolean {
    return hasSelection(getEditorView().state, true);
  }

  function openFindPanel() {
    let view = getEditorView();
    openSearchPanel(view);
  }

  async function executeCommand(cmdId: number, arg: any) {
    // console.log("cmd:", cmdId);
    appState.showingContextMenu = false;
    appState.showingCommandPalette = false;

    if (typeof arg == "function") {
      await arg();
      return;
    }

    // lazy — only call when a branch actually needs the editor
    let view: EditorView;
    let ednaEditor: MultiBlockEditor;
    function requireView(): EditorView {
      if (!view) view = getEditorView();
      return view;
    }
    function requireEditor(): MultiBlockEditor {
      if (!ednaEditor) ednaEditor = getEditor();
      return ednaEditor;
    }
    function focusView() {
      // no editor e.g. on Home tab
      getEditorView()?.focus();
    }

    if (cmdId === kCmdCommandPalette) {
      openCommandPalette();
    } else if (cmdId === kCmdOpenNote) {
      openNoteSelector();
    } else if (cmdId === kCmdOpenNoteInNewTab) {
      openNoteSelectorInNewTab();
    } else if (cmdId === kCmdCreateNewNote) {
      openCreateNewNote();
    } else if (cmdId === kCmdCloseCurrentTab) {
      closeCurrentTab();
      focusEditor();
    } else if (cmdId === kCmdRenameCurrentNote) {
      appState.showingRenameNote = true;
    } else if (cmdId == kCmdPermanentlyDeleteNote) {
      deleteNotePermanently(noteName!, true);
      focusView();
    } else if (cmdId === kCmdArchiveCurrentNote) {
      archiveNote(noteName!);
      focusView();
    } else if (cmdId === kCmdUnArchiveCurrentNote) {
      unArchiveNote(noteName!);
      focusView();
    } else if (cmdId === kCmdCreateScratchNote) {
      await createScratchNote();
      focusView();
    } else if (cmdId === kCmdNewBlockAfterCurrent) {
      addNewBlockAfterCurrent(requireView());
      focusView();
    } else if (cmdId === kCmdNewBlockBeforeCurrent) {
      addNewBlockBeforeCurrent(requireView());
      focusView();
    } else if (cmdId === kCmdNewBlockAtEnd) {
      addNewBlockAfterLastAndScrollDown(requireView());
      focusView();
    } else if (cmdId === kCmdNewBlockAtStart) {
      addNewBlockBeforeFirst(requireView());
      focusView();
    } else if (cmdId === kCmdSplitBlockAtCursor) {
      insertNewBlockAtCursor(requireView());
      focusView();
    } else if (cmdId === kCmdGoToBlock) {
      openBlockSelector();
    } else if (cmdId === kCmdGoToNextBlock) {
      gotoNextBlock(requireView());
      focusView();
    } else if (cmdId === kCmdTransposeChars) {
      transposeChars(requireView());
      focusView();
    } else if (cmdId === kCmdToggleComment) {
      toggleComment(requireView());
      focusView();
    } else if (cmdId === kCmdToggleLineComment) {
      toggleLineComment(requireView());
      focusView();
    } else if (cmdId === kCmdToggleBlockComment) {
      toggleBlockComment(requireView());
      focusView();
    } else if (cmdId === kCmdToggleCheckbox) {
      toggleCheckbox(requireView());
      focusView();
    } else if (cmdId === kCmdInsertDateAndTime) {
      insertDateAndTime(requireView());
      focusView();
    } else if (cmdId === kCmdInsertTime) {
      insertTime(requireView());
      focusView();
    } else if (cmdId === kCmdGoToPreviousBlock) {
      gotoPreviousBlock(requireView());
      focusView();
    } else if (cmdId === kCmdMoveBlockUp) {
      moveCurrentBlockUp(requireView());
      focusView();
    } else if (cmdId === kCmdMoveBlockDown) {
      moveCurrentBlockDown(requireView());
      focusView();
    } else if (cmdId === kCmdChangeBlockLanguage) {
      openLanguageSelector();
    } else if (cmdId === kCmdBlockSelectAll) {
      selectAll(requireView());
      focusView();
    } else if (cmdId === kCmdFormatBlock) {
      formatCurrentBlock();
      focusView();
    } else if (cmdId === kCmdMoveBlock) {
      moveCurrentBlock();
    } else if (cmdId === kCmdFoldCode) {
      foldCode(requireView());
      focusView();
    } else if (cmdId === kCmdUnfoldColde) {
      unfoldCode(requireView());
      focusView();
    } else if (cmdId === kCmdFoldBlock) {
      foldBlock(requireEditor())(requireView());
      focusView();
    } else if (cmdId === kCmdUnfoldBlock) {
      unfoldBlock(requireEditor())(requireView());
      focusView();
    } else if (cmdId === kCmdMoveLineUp || cmdId === kCmdMoveSelectionUp) {
      moveLineUp(requireView());
      focusView();
    } else if (cmdId === kCmdMoveLineDown || cmdId === kCmdMoveSelectionDown) {
      moveLineDown(requireView());
      focusView();
    } else if (cmdId === kCmdFoldAllBlocks) {
      foldAllBlocks(requireEditor())(requireView());
      focusView();
    } else if (cmdId === kCmdUnfoldAllBlocks) {
      unfoldAlBlocks(requireEditor())(requireView());
      focusView();
    } else if (cmdId === kCmdUnfoldEverything) {
      unfoldEverything(requireEditor())(requireView());
      focusView();
    } else if (cmdId === kCmdToggleBlockFold) {
      toggleBlockFold(requireEditor())(requireView());
      focusView();
    } else if (cmdId === kCmdExportCurrentBlock) {
      await exportCurrentBlock();
      focusView();
    } else if (cmdId === kCmdBlockDelete) {
      focusView();
      tick().then(() => {
        deleteBlock(requireEditor())(requireView());
      });
    } else if (cmdId === kCmdOpenNoteFromDisk) {
      openNoteFromDisk();
    } else if (cmdId === kCmdAskAI) {
      openAskAI();
    } else if (cmdId === kCmdToggleSpellChecking) {
      toggleSpellCheck();
      focusView();
    } else if (cmdId === kCmdShowHelp) {
      showHTMLHelp();
    } else if (cmdId === kCmdShowHelpAsNote) {
      openNote(kHelpSystemNoteName);
    } else if (cmdId === kCmdShowReleaseNotes) {
      openNote(kReleaseNotesSystemNoteName);
    } else if (cmdId === kCmdShowWelcomeNote) {
      openNote(kWelcomeSystemNoteName);
    } else if (cmdId === kCmdRunHelp) {
      showHTMLHelp("#running-code");
    } else if (cmdId == kCmdShowWelcomeDevNote) {
      openNote(kWelcomeDevSystemNoteName);
    } else if (cmdId === kCmdMoveNotesToDirectory) {
      storeNotesOnDisk();
    } else if (cmdId === kCmdSwitchToNotesInDir) {
      await switchStorage(switchToDirectory);
    } else if (cmdId === kCmdSwitchToLocalStorage) {
      await switchStorage(switchToBrowserStorage);
    } else if (cmdId === kCmdExportNotes) {
      exportNotesToZipFile();
    } else if (cmdId === kCmdExportCurrentNote) {
      exportCurrentNote();
    } else if (cmdId === kCmdNoteToggleStarred) {
      toggleCurrentNoteStar();
    } else if (cmdId === kCmdShowStorageHelp) {
      showHTMLHelp("#storing-notes-on-disk");
    } else if (cmdId === kCmdSettings) {
      openSettings();
    } else if (cmdId === kCmdEncryptNotes) {
      openEncryptPassword();
    } else if (cmdId === kCmdDecryptNotes) {
      runStorageOp(decryptAllNotes);
    } else if (cmdId === kCmdEncryptionHelp) {
      showHTMLHelp("#encryption");
    } else if (cmdId === kCmdOpenQuickAccess) {
      openQuickAccess();
    } else if (cmdId === kCmdRunBlock) {
      runCurrentBlock();
    } else if (cmdId === kCmdRunBlockWithAnotherBlock) {
      runCurrentBlockWithAnotherBlock();
    } else if (cmdId === kCmdRunBlockWithClipboard) {
      runCurrentBlockWithClipboard();
    } else if (cmdId === kCmdSmartRun) {
      smartRun();
    } else if (cmdId === kCmdRunFunctionWithBlockContent) {
      openFunctionSelector(false);
    } else if (cmdId === kCmdRunFunctionWithSelection) {
      openFunctionSelector(true);
    } else if (cmdId === kCmdCreateYourOwnFunctions) {
      openCustomFunctionsNote();
    } else if (cmdId === kCmdShowBuiltInFunctions) {
      openNote(kBuiltInFunctionsNoteName);
    } else if (cmdId === kCmdToggleSidebar) {
      toggleFlag(settings, "showSidebar");
      if (!settings.showSidebar) {
        focusEditor();
      }
    } else if (cmdId === kCmdFind || cmdId == kCmdSearch) {
      openFindPanel();
    } else if (cmdId === kCmdFindInNotes || cmdId == kCmdSearchInNotes) {
      openFindInNotes();
    } else if (cmdId === kCmdTestErrorTracking) {
      console.error("test console error");
      throw new Error("test error from menu");
    } else {
      console.error("unknown menu cmd id");
    }
  }

  async function openCustomFunctionsNote() {
    let content = getMyFunctionsNote();
    await createIfNotExists(kMyFunctionsNoteName, content);
    await openNote(kMyFunctionsNoteName);
  }

  let contextMenuDef: MenuDef = $state([]);

  async function oncontextmenu(ev: MouseEvent) {
    console.log("oncontextmenu");
    if (isShowingDialog) {
      console.log("oncontestmenu: isShowingDialog");
      return;
    }
    // show native context menu if ctrl or shift is pressed
    // especially important for spell checking
    let forceNativeMenu = ev.ctrlKey;
    if (forceNativeMenu) {
      return;
    }
    await openContextMenu(ev);
  }

  async function openContextMenu(ev: MouseEvent, pos?: { x: number; y: number }) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    contextMenuDef = buildMenuDef();
    contextMenuPos = pos || { x: ev.x, y: ev.y };
    appState.showingContextMenu = true;
  }

  function commandNameOverride(id: number, name?: string): string {
    if (id === kCmdToggleSpellChecking) {
      return (isSpellChecking ? "Disable" : "Enable") + " spell checking";
    }
    let n = len(commandNameOverrides);
    for (let i = 0; i < n; i += 2) {
      if (id == commandNameOverrides[i]) {
        return commandNameOverrides[i + 1] as string;
      }
    }
    if (id >= kCmdBlockFirst && id <= kCmdBlockLast) {
      return "Block: " + name;
    }
    if (id === kCmdNoteToggleStarred) {
      return toggleFavoriteLabel("current note ");
    }
    return name || "";
  }

  function buildCommandsDef(): Command[] {
    let a: Command[] = [];
    function addMenuItems(items: Command[]) {
      for (let mi of items) {
        // console.log(mi);
        let name = mi[0];
        let idOrSubMenu = mi[1];
        if (Array.isArray(idOrSubMenu)) {
          addMenuItems(idOrSubMenu);
          continue;
        }
        let id = idOrSubMenu;
        if (id <= 0) {
          // separator and static items
          continue;
        }
        if (id === kCmdCommandPalette) {
          continue;
        }
        const miStatus = menuItemStatus(mi);
        if (miStatus != kMenuStatusNormal) {
          // filter out disabled and removed
          continue;
        }
        name = commandNameOverride(id, name);
        let el: Command = [name, id];
        a.push(el);
      }
    }
    let mdef = buildMenuDef();
    addMenuItems(mdef);
    return a;
  }

  let commandsDef: Command[] = $state([]);

  function buildCommandPaletteDef() {
    commandsDef = buildCommandsDef();
    for (let mi of commandPaletteAdditions) {
      let status = menuItemStatus(mi);
      if (status != kMenuStatusNormal) {
        continue;
      }
      commandsDef.push(mi);
    }
    // console.log("commandPaletteAdditions:", commandPaletteAdditions);
    if (editorComp) {
      let name = commandNameOverride(kCmdToggleSpellChecking);
      commandsDef.push([name, kCmdToggleSpellChecking]);
    }
  }

  async function closeTab(tab: string) {
    if (tab != settings.currentTab) {
      settingsRemoveTab(settings, tab);
      return;
    }
    // save current editor state before switching away
    if (editorComp) {
      if (!(await saveOrShowError(() => getEditor().save(), tab))) {
        return;
      }
    }
    let idx = settings.tabs.indexOf(tab);
    settingsRemoveTab(settings, tab);
    // note: idx is -1 if the current tab wasn't in tabs (T-I1 broken)
    idx = Math.max(0, Math.min(idx, len(settings.tabs) - 1));
    let toOpen = settings.tabs[idx];
    if (!toOpen || isTabHome(toOpen)) {
      settings.currentTab = kTabHome;
    } else {
      openNote(toOpen, false);
    }
  }

  function closeCurrentTab() {
    if (len(settings.tabs) < 2) {
      return;
    }
    closeTab(settings.currentTab);
  }

  function openAskAI() {
    let view = getEditorView();
    let b = getActiveNoteBlock(view.state)!;
    let { selectedText } = getCurrentSelection(view.state);
    askAIStartText = selectedText ? selectedText : blockContentText(view.state, b);
    appState.showingAskAI = true;
  }

  function openCommandPalette() {
    buildCommandPaletteDef();
    appState.showingCommandPalette = true;
  }

  function getEditorComp(): Editor {
    return editorComp;
  }

  function getEditor(): MultiBlockEditor {
    return editorComp.getEditor();
  }

  function getEditorView(): EditorView {
    if (!editorComp) {
      // TODO: change result type to EditorView | undefined but it'll
      // require fixing a lot of callers
      // @ts-ignore
      return;
    }
    let view = editorComp.getEditorView();
    return view;
  }

  function formatCurrentBlock() {
    formatBlockContent(getEditor());
    logNoteOp("noteFormatBlock");
  }

  function toggleCurrentNoteStar() {
    toggleNoteStarred(noteName!);
    getEditor().focus();
  }

  // returns false if the response couldn't be inserted
  function insertAskAIResponse(s: string): boolean {
    let view = getEditorView();
    if (!view || isReadOnly(view)) {
      return false;
    }
    let text = blockHdrMarkdown + s;
    return insertAfterActiveBlock(view, text);
  }

  // runs the content of the active block with evaluate() and inserts the output
  // as a new block after it
  async function runActiveBlock(
    editor: MultiBlockEditor,
    evaluate: (token: string, content: string) => Promise<CapturingEval>,
  ): Promise<boolean> {
    const { state } = editor.view;
    const block = getEditableActiveBlock(state);
    if (!block || !blockLanguageSupportsRun(block.language)) {
      return false;
    }
    const content = blockContentText(state, block);
    let res = await withRun(editor, async (run) => {
      showModalMessageHTML("running code", 300, "run");
      let res = await evaluate(block.language, content);
      let output = evalResultToString(res) || "executed code returned empty output";
      await insertRunOutputBlock(run, output);
      return true;
    });
    return !!res;
  }

  export async function runBlockContent(editor: MultiBlockEditor): Promise<boolean> {
    return runActiveBlock(editor, (token, content) => {
      return token === "golang" ? runGo(content) : runJS(content);
    });
  }

  export async function runBlockContentWithArg(editor: MultiBlockEditor, arg: string): Promise<boolean> {
    return runActiveBlock(editor, async (token, content) => {
      if (token === "javascript") {
        return runJSWithArg(content, arg);
      }
      return {
        output: "",
        consoleLogs: [],
        exception: `Error: unspported language '${token}'`,
      };
    });
  }

  function runCurrentBlock() {
    let editor = getEditor();
    runBlockContent(editor);
    editor.focus();
    logNoteOp("runBlock");
  }

  let fnSelectBlock: (block: NoteBlock) => void = $state(selectBlock);

  function runBlockWithAnotherBlock(block: NoteBlock) {
    closeDialogs();
    let n = block.index;
    let editor = getEditor();
    let state = editor.view.state;
    let blockArg = getBlockN(state, n);
    runWithArgAndFocus(editor, blockContentText(state, blockArg), "runBlockWithBlock");
  }

  function runWithArgAndFocus(editor: MultiBlockEditor, arg: string, logOp: string) {
    runBlockContentWithArg(editor, arg);
    editor.focus();
    logNoteOp(logOp);
  }

  function currentBlockSupportsRun(state: EditorState): boolean {
    return blockLanguageSupportsRun(getActiveNoteBlock(state)!.language);
  }

  function runCurrentBlockWithAnotherBlock() {
    let view = getEditorView();
    if (!currentBlockSupportsRun(view.state)) {
      return;
    }
    openBlockSelector(runBlockWithAnotherBlock);
  }

  async function runCurrentBlockWithClipboard() {
    let editor = getEditor();
    if (!currentBlockSupportsRun(editor.view.state)) {
      return;
    }
    runWithArgAndFocus(editor, await getClipboardText(), "runBlockWithClipboard");
  }

  // if have a selection, run function with selection
  // if runnable block, run the block
  // otherwise run a function with current block
  function smartRun() {
    let view = getEditorView();
    if (isReadOnly(view)) {
      return;
    }

    let block = getActiveNoteBlock(view.state)!;
    let action = smartRunAction(editorHasSelection(), block.language);
    if (action === "codeBlock") {
      runCurrentBlock();
    } else {
      openFunctionSelector(action === "functionWithSelection");
    }
  }

  function toggleSpellCheck() {
    isSpellChecking = !isSpellChecking;
    getEditorComp().setSpellChecking(isSpellChecking);
    // if (isSpellChecking) {
    //   addToast(
    //     "Press Ctrl + right mouse click for context menu when spell checking is enabled",
    //   );
    // }
  }

  function showHTMLHelp(anchor: string = "") {
    // let uri = window.location.origin + "/help"
    let uri = "/help";
    if (anchor != "") {
      uri += anchor;
    }
    window.open(uri, "_blank");
  }

  async function onRename(newName: string) {
    let currentNote = appState.currentNoteName!;
    closeDialogs();
    let editor = getEditor();
    // save pending edits now: a pending auto-save of the old name firing
    // after the rename would re-create the old note
    if (!(await saveOrShowError(() => editor.save(), currentNote))) {
      return;
    }
    let s = editor.getContent() || "";
    try {
      await renameNote(currentNote, newName, s);
    } catch (e) {
      showError(`Failed to rename note '${currentNote}': ${e}`);
      return;
    }
    await openNote(newName, true);
  }

  function openQuickAccess() {
    appState.showingQuickAccess = true;
  }

  async function onOpenNote(name: string, newTab = false) {
    // must get before closeDialg()
    let forceNewTab = appState.forceNewTab;

    closeDialogs();
    if (name == settings.currentTab) {
      return;
    }
    if (forceNewTab) {
      newTab = true;
    }

    // current tab is replaced when the note is shown (in didLoadNote), so that
    // a load that fails or is superseded doesn't change tabs
    await openNote(name, false, false, !newTab);
  }

  // returns true if the note was loaded and shown
  async function openNote(name: string, skipSave = false, noPushHistory = false, replaceTab = false) {
    console.log("App.openNote:", name);
    if (!editorComp) {
      // Editor not mounted (e.g. coming from Home tab).
      // Setting currentTab mounts the Editor, whose onMount loads the note.
      settings.currentTab = name;
      settingsAddTab(settings, name);
      return true;
    }
    let msg = html`Loading <span class="font-bold">${name}</span>...`;
    showModalMessageHTML(msg, 300, "load");
    let ok = false;
    try {
      ok = await getEditorComp().openNote(name, skipSave, noPushHistory, replaceTab);
    } finally {
      clearModalMessage("load");
    }
    // note: editor might have been unmounted (e.g. switched to Home tab) while loading
    editorComp?.focus();
    return ok;
  }

  // position to move the cursor to after note is loaded (see didLoadNote)
  let pendingCursorPos: { note: string; pos: number } | undefined;

  function openNoteFromFind(name: string, pos: number) {
    closeDialogs();
    if (name === noteName && editorComp) {
      setCursorPos(pos);
      return;
    }
    pendingCursorPos = { note: name, pos };
    openNote(name);
  }

  // the open note can have unsaved edits: search what's in the editor
  async function getNoteContentForFind(name: string): Promise<string | undefined> {
    if (name === noteName && editorComp) {
      return getEditor().getContent();
    }
    return loadNote(name);
  }

  // positions past the end (e.g. the note changed since pos was found) are ignored
  function setCursorPos(pos: number) {
    let view = getEditorView();
    if (view && pos <= view.state.doc.length) {
      getEditor().setCursorPosition(pos);
    }
  }

  function moveCurrentBlock() {
    appState.showingBlockMoveSelector = true;
  }

  async function onMoveBlockToNote(name: string) {
    appState.showingBlockMoveSelector = false;
    if (name.toLowerCase() === (noteName || "").toLowerCase()) {
      // appending to the note and then deleting the block would lose it
      showWarning("Can't move a block to the note it's in");
      return;
    }
    // name can be new or existing note
    let state = getEditorView().state;
    let block = getActiveNoteBlock(state)!;
    let delim = state.sliceDoc(block.from, block.contentFrom);
    let content = blockContentText(state, block);
    try {
      await appendToNote(name, delim + content);
    } catch (e) {
      // e.g. invalid name or a system note: the block stays where it is
      showError(`${e}`);
      return;
    }
    let view = getEditorView();
    let ednaEditor = getEditor();
    deleteBlock(ednaEditor)(view);
    view.focus();
  }

  async function onCreateNote(name: string) {
    closeDialogs();
    try {
      await createNoteWithName(name);
    } catch (e) {
      showError(`${e}`);
      return;
    }
    openNote(name);
    didCreateNote(name, "note");
  }

  async function deleteNotePermanently(name: string, showNotif: boolean) {
    if (!canDeleteNote(name)) {
      showWarning(`Can't delete special note ${name}`);
      console.log("cannot delete note:", name);
      return;
    }

    let settings = getSettings();
    settingsRemoveTab(settings, name);
    // if deleting current note, first switch to scratch note
    // TODO: maybe switch to the most recently opened
    if (name === settings.currentTab || len(settings.tabs) == 0) {
      let ok = await openNote(kScratchNoteName);
      if (!ok && appState.currentNoteName === name) {
        // still showing the note: its next save would re-create it (U19)
        settingsAddTab(settings, name);
        showError(`Can't delete note '${name}': failed to switch to '${kScratchNoteName}'`);
        return;
      }
    }

    console.log("deleted note", name);
    await deleteNote(name);
    if (showNotif) {
      showToast(`Deleted note '${name}'`);
    }
    logNoteOp("noteDelete");
  }

  function onCursorChange(e: SelectionChangeEvent): void {
    line = e.cursorLine.line;
    column = e.cursorLine.col;
    selectionSize = e.selectionSize;
    language = e.language;
    languageAuto = e.languageAuto;
  }

  function updateDocSize() {
    let editor = getEditor();
    const c = editor.getContent() || "";
    docSize = stringSizeInUtf8Bytes(c);
  }

  function autoCreateDayInJournal(editor: MultiBlockEditor) {
    // create block for a current day if doesn't exist
    let s = blockHdrMarkdown + "# " + formatDateYYYYMMDDDay();
    let content = editor.getContent();
    if (content.includes(s)) {
      return;
    }
    // console.log("autoCreateDayInJournal: inserting:", s);
    insertBlockAt(editor.view, 0, s + "\n", { userEvent: "input" });
  }

  // called when note `name` was loaded and shown in the editor
  function didLoadNote(name: string, noPushHistory = false, replaceTab = false) {
    console.log("didLoadNote:", name);
    throwIf(!name);
    if (replaceTab && !settings.tabs.includes(name) && !isTabHome(settings.currentTab)) {
      // replace current tab with the new note
      arrayReplace(settings.tabs, settings.currentTab, name);
    }
    let editor = getEditor();
    let readOnly = isSystemNoteName(name);
    editor.setReadOnly(readOnly);
    window.document.title = name;
    if (!noPushHistory) {
      addNoteToBrowserHistory(name);
      addNoteToHistory(name);
    }
    settings.currentTab = name;
    if (name == kDailyJournalNoteName) {
      // doesn't work without delay
      setTimeout(() => autoCreateDayInJournal(editor), 100);
      // console.log("journal, so going to next block");
      // editor.gotoNextBlock();
    }
    settingsAddTab(settings, name);
    updateDocSize();
    // note: called after selection was restored, so this overrides it
    if (pendingCursorPos) {
      if (pendingCursorPos.note === name) {
        setCursorPos(pendingCursorPos.pos);
      }
      pendingCursorPos = undefined;
    }
  }

  // computing size in utf8 bytes is expensive for large documents so we don't do it on every keystroke
  const updateDocSizeDebounced = debounce(() => {
    if (editorComp) {
      updateDocSize();
    }
  }, 300);

  function docDidChange() {
    updateDocSizeDebounced();
  }

  // debug functions to be called from dev tools console as:
  // window.edna.debug.clearLocalStorage etc.
  // @ts-ignore
  window.edna = {
    debug: {
      removeLocalStorageNotes: debugRemoveLocalStorageNotes,
    },
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 grid w-screen max-h-screen h-screen grid-cols-[auto_1fr] grid-rows-[auto_1fr]"
  {oncontextmenu}
>
  {#if settings.alwaysShowTopNav}
    <TopNav
      class="row-start-1 col-start-1 col-span-2"
      openNote={onOpenNote}
      {closeTab}
      {openNoteSelector}
      {openNoteSelectorInNewTab}
      {menuItemStatus}
      {executeCommand}
      {buildMenuDef}
    />
  {:else}
    <div class="row-start-1 col-start-1 col-span-2"></div>
  {/if}
  {#if settings.showSidebar}
    <Sidebar openNote={onOpenNote} class="row-start-2 col-start-1"></Sidebar>
  {:else}
    <div class="row-start-2 col-start-1"></div>
  {/if}
  {#if isTabHome(settings.currentTab)}
    <HomePage class="row-start-2 col-start-2" />
  {:else}
    <Editor
      class="row-start-2 col-start-2"
      cursorChange={onCursorChange}
      {extraKeymap}
      {didLoadNote}
      {docDidChange}
      bind:this={editorComp}
    />
  {/if}
</div>

{#if !settings.alwaysShowTopNav}
  <TopNav openNote={onOpenNote} {closeTab} {openNoteSelector} {openNoteSelectorInNewTab} {menuItemStatus} {executeCommand} {buildMenuDef} />
{/if}
{#if !isTabHome(settings.currentTab)}
  <StatusBar
    {line}
    {column}
    {docSize}
    {selectionSize}
    {language}
    {languageAuto}
    {isSpellChecking}
    {openLanguageSelector}
    {formatCurrentBlock}
    {smartRun}
    {toggleSpellCheck}
  />
{/if}

{#if appState.showingQuickAccess}
  <Overlay onclose={closeDialogs} blur={true}>
    <QuickAccess openNote={onOpenNote} forHistory={true} />
  </Overlay>
{/if}

{#if appState.showingCreateNewNote}
  <Overlay onclose={closeDialogs} blur={true}>
    <CreateNewNote createNewNote={onCreateNote} onclose={closeDialogs}></CreateNewNote>
  </Overlay>
{/if}

{#if showingBlockSelector && fnSelectBlock}
  <Overlay onclose={closeDialogs} blur={true}>
    <BlockSelector blocks={blockItems} selectBlock={fnSelectBlock} initialSelection={initialBlockSelection}
    ></BlockSelector>
  </Overlay>
{/if}

{#if appState.showingFunctionSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <FunctionSelector context={functionContext} {userFunctions} {runFunction}></FunctionSelector>
  </Overlay>
{/if}

{#if appState.showingBlockMoveSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <NoteSelector
      header="Move current block to note:"
      forMoveBlock={true}
      openNote={onMoveBlockToNote}
      createNote={onMoveBlockToNote}
      deleteNote={deleteNotePermanently}
    />
  </Overlay>
{/if}

{#if appState.showingNoteSelector}
  {#if settings.useWideSelectors}
    <Overlay onclose={closeDialogs} blur={true}>
      <NoteSelectorWide
        switchToRegularNoteSelector={() => setUseWideSelectors(false)}
        {switchToCommandPalette}
        openNote={onOpenNote}
        deleteNote={deleteNotePermanently}
        createNote={onCreateNote}
      />
    </Overlay>
  {:else}
    <Overlay onclose={closeDialogs} blur={true}>
      <NoteSelector
        switchToWideNoteSelector={() => setUseWideSelectors(true)}
        {switchToCommandPalette}
        openNote={onOpenNote}
        createNote={onCreateNote}
        deleteNote={deleteNotePermanently}
      />
    </Overlay>
  {/if}
{/if}

{#if appState.showingLanguageSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <LanguageSelector selectLanguage={onSelectLanguage} />
  </Overlay>
{/if}

<!-- busy messages are hidden while a prompt (that the operation waits for) is showing -->
{#if modalMessageState.isShowing && !appState.showingDecryptPassword && !appState.showingAskFileWritePermissions}
  <ModalMessage />
{/if}

{#if appState.showingRenameNote}
  <Overlay onclose={closeDialogs} blur={true}>
    <RenameNote onclose={closeDialogs} rename={onRename} oldName={noteName!} />
  </Overlay>
{/if}

{#if appState.showingSettings}
  <Overlay onclose={closeDialogs} blur={true}>
    <Settings></Settings>
  </Overlay>
{/if}
<Toaster></Toaster>

{#if appState.showingCommandPalette}
  <Overlay onclose={closeDialogs} blur={true}>
    <CommandPalette {commandsDef} {executeCommand} {switchToNoteSelector} />
  </Overlay>
{/if}

{#if appState.showingContextMenu}
  <Overlay onclose={closeDialogs}>
    <Menu {menuItemStatus} {executeCommand} menuDef={contextMenuDef} pos={contextMenuPos} />
  </Overlay>
{/if}

{#if appState.showingFindInNotes}
  <Overlay blur={true} onclose={closeDialogs}>
    <FindInNotes openNote={openNoteFromFind} getNoteContent={getNoteContentForFind}></FindInNotes>
  </Overlay>
{/if}

{#if appState.showingEncryptPassword}
  <Overlay onclose={closeEncryptPassword} blur={true}>
    <EnterEncryptPassword onclose={closeEncryptPassword} onpassword={onEncryptPassword}></EnterEncryptPassword>
  </Overlay>
{/if}

{#if appState.showingDecryptPassword && passwordPrompt}
  <PasswordPrompt {...passwordPrompt} />
{/if}

{#if appState.showingAskFileWritePermissions}
  <Overlay noCloseOnEsc={true} blur={true}>
    <AskFileWritePermissions fileHandle={fileWritePermissionsFileHandle!} close={askFileWritePermissionsClose}
    ></AskFileWritePermissions>
  </Overlay>
{/if}

{#if appState.showingAskAI}
  <Overlay blur={true} onclose={closeDialogs}>
    <AskAI close={closeDialogs} startText={askAIStartText} insertResponse={insertAskAIResponse}></AskAI>
  </Overlay>
{/if}
