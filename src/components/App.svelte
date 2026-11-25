<script lang="ts">
  import { tick } from "svelte";
  import debounce from "debounce";
  import { toggleBlockComment, toggleComment, toggleLineComment } from "@codemirror/commands";
  import { foldCode, unfoldCode } from "@codemirror/language";
  import { openSearchPanel, searchPanelOpen } from "@codemirror/search";
  import { EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { appState } from "../appstate.svelte";
  import {
    blockHdrMarkdown,
    isTabHome,
    kBuiltInFunctionsNoteName,
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
    rangeInFirstBlock,
    replaceBlockContent,
  } from "../editor/block/block";
  import type { NoteBlock } from "../block-format";
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
    unfoldAllBlocks,
    unfoldBlock,
    unfoldEverything,
  } from "../editor/fold-gutter";
  import { extForLang, getLanguage } from "../editor/languages";
  import { toFileName } from "../filenamify";
  import {
    fsFileHandleWrite,
    hasHandlePermission,
    isBraveWithoutFileSystem,
    kBraveEnableFileSystemMsg,
    openDirPicker,
    supportsFileSystem,
  } from "../fileutil";
  import { formatBlockContent } from "../format-code";
  import { boopFunctionResult, isCursorFunction, parseUserFunctions, runBoopFunction } from "../functions";
  import { parseArgSchema, type ArgSpec, type BoopFunction, type BoopFunctionArg } from "../functions";
  import { askPassword, askUser, clearGlobalFuncs, setGlobalFuncs, type PasswordPromptProps } from "../globals";
  import { addNoteToHistory } from "../history";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import { hasOtherInstances, startInstanceDetection } from "../instances";
  import { getMarkdownHeadings } from "../markdown-util";
  import { toggleBlockReadOnly } from "../editor/read-only-blocks";
  import {
    archiveNote,
    getNoteMeta,
    getNotesMetadata,
    isNoteArchived,
    noteHasDailyEntry,
    setNoteDailyEntry,
    toggleNoteStarred,
    unArchiveNote,
  } from "../metadata";
  import { isMoving } from "../mouse-track.svelte";
  import { smartRunAction } from "../smart-run";
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
    notePathFromNameFS,
    rememberOpenedNote,
    renameNote,
    switchToStoringNotesOnDisk,
  } from "../notes";
  import { browserDownloadBlob, exportNotesToZip } from "../notes-export";
  import { evalResultToString, getBlockRunner } from "../run";
  import {
    getSettings,
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
    valueOrUndefined,
    trimSuffix,
  } from "../util";
  import AskAI from "./AskAI.svelte";
  import AskFileWritePermissions from "./AskFileWritePermissions.svelte";
  import BlockSelector from "./BlockSelector.svelte";
  import FunctionArgsDialog from "./FunctionArgsDialog.svelte";
  import MarkdownPreview from "./MarkdownPreview.svelte";
  import type { Item as SelectorItem } from "./BlockSelector.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import CreateNewNote from "./CreateNewNote.svelte";
  import PasswordPrompt from "./PasswordPrompt.svelte";
  import EnterEncryptPassword from "./EnterEncryptPassword.svelte";
  import { closeFindPanel } from "./Find.svelte";
  import FindInNotes from "./FindInNotes.svelte";
  import FunctionSelector from "./FunctionSelector.svelte";
  import HomePage from "./HomePage.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import Menu, { type Command, type MenuDef } from "./Menu.svelte";
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

  interface Props {
    boot: () => Promise<void>;
    switchToBrowserStorage: () => Promise<void>;
    switchToDirectory: () => Promise<void>;
  }

  let { boot, switchToBrowserStorage, switchToDirectory }: Props = $props();

  const isMac = platform.isMac;

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
  // a running function waiting for the user to enter its arguments (#60)
  let argsRequest:
    | { title: string; specs: ArgSpec[]; resolve: (v: Record<string, string | number | boolean> | null) => void }
    | undefined = $state();

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
    showingBlockSelector || !!argsRequest || [...kClosableDialogs, ...kAnswerDialogs].some((key) => appState[key]),
  );

  function closeDialogs() {
    for (let key of kClosableDialogs) {
      appState[key] = false;
    }
    showingBlockSelector = false;

    appState.forceNewTab = false;

    focusEditor();
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

  let gf = {
    focusEditor: focusEditor,
    getPasswordFromUser: getPasswordFromUser,
    requestFileWritePermission: requestFileWritePermission,
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
    ["Alt-Shift-f", formatCurrentBlock],
    ["Mod-l", openLanguageSelector],
    ["Mod-e", smartRun],
    ["Alt-Shift-r", () => openFunctionSelector(false)],
    ["Mod-b", () => openBlockSelector()],
    ["Mod-Shift-b", openHeadingSelector],
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
        logAppExit(appState.allNotes.length);
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

    logAppOpen(appState.allNotes.length);

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
      const view = editorComp?.getEditorView();
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
    await runStorageOp(async () => {
      const directory = await openDirPicker(true);
      if (!directory) return;
      const renamed = await switchToStoringNotesOnDisk(directory);
      for (const [from, to] of renamed) {
        showWarning(`Note '${from}' already exists in the directory, moved as '${to}'`);
      }
      await boot();
    });
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

  let passwordPrompt: PasswordPromptProps | undefined = $state();

  function getFunctionArguments(fnName: string, schema: unknown): Promise<Record<string, string | number | boolean> | null> {
    // throws for an invalid schema, which fails the function with that error
    let specs = parseArgSchema(schema);
    if (argsRequest) {
      return Promise.reject(new Error("getArgumentsFromUser: already waiting for arguments"));
    }
    return new Promise((resolve) => {
      argsRequest = { title: fnName, specs, resolve };
    });
  }

  function answerFunctionArguments(values: Record<string, string | number | boolean> | null) {
    let req = argsRequest;
    argsRequest = undefined;
    req?.resolve(values);
  }

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

  let changingStorage = false;

  async function runStorageOp(fn: () => Promise<unknown>) {
    if (changingStorage || runInProgress) {
      showWarning("Wait for the current operation to finish before changing storage.");
      return;
    }
    changingStorage = true;
    try {
      if (!(await checkSingleInstance())) return;
      const editor = editorComp?.getEditor();
      await withReadOnlyEditor(editor, () => editorComp?.getEditor() === editor, async () => {
        if (await saveBeforeStorageSwitch()) await fn();
      });
    } catch (error) {
      if (!(error instanceof PasswordCancelledError)) showError(`${error}`);
    } finally {
      changingStorage = false;
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
    // fails if the user cancels
    // @ts-ignore
    let fileHandles: FileSystemFileHandle[] | undefined = await valueOrUndefined(window.showOpenFilePicker(opts), "showOpenFilePicker:");
    if (!fileHandles) {
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
    // fails if the user cancels
    // @ts-ignore
    let fh: FileSystemFileHandle | undefined = await valueOrUndefined(window.showSaveFilePicker(opts), "showSaveFilePicker:");
    if (fh) {
      await fsFileHandleWrite(fh, blob);
    }
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
    let fileName = notePathFromNameFS(noteName!, false);
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

  // state of BlockSelector, which lists blocks or headings
  let selectorItems: SelectorItem[] = $state([]);
  let selectorNoun = $state("block");
  let initialBlockSelection = $state(0);
  let onSelectorPick: (item: SelectorItem) => void = $state(() => {});

  function openBlockSelector(fn = selectBlock) {
    console.log("openBlockSelector");
    let editor = getEditor();
    let { blocks, active } = getBlocksInfo(editor.view.state);
    let content = editor.getContent();
    selectorItems = blocks.map((b) => ({
      key: b.index,
      text: extractBlockTitle(content, b.contentFrom, b.to),
    }));
    selectorNoun = "block";
    initialBlockSelection = active;
    onSelectorPick = (item) => fn(blocks[item.key]!);
    showingBlockSelector = true;
  }

  // lists headings of the current markdown block, to go to one of them (#61)
  function openHeadingSelector() {
    let view = getEditorView();
    let block = getActiveNoteBlock(view.state)!;
    if (block.language !== "markdown") {
      showWarning("Go to heading works in markdown blocks");
      return;
    }
    let content = view.state.sliceDoc(block.contentFrom, block.to);
    let headings = getMarkdownHeadings(content);
    if (headings.length === 0) {
      showToast("This block has no headings");
      return;
    }
    let minLevel = Math.min(...headings.map((h) => h.level));
    selectorItems = headings.map((h, i) => ({ key: i, text: h.text, indent: h.level - minLevel }));
    selectorNoun = "heading";
    // the heading the cursor is under
    let cursor = view.state.selection.main.head - block.contentFrom;
    initialBlockSelection = Math.max(0, headings.findLastIndex((h) => h.offset <= cursor));
    onSelectorPick = (item) => {
      closeDialogs();
      let pos = block.contentFrom + headings[item.key]!.offset;
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 32 }),
        userEvent: "select",
      });
      view.focus();
    };
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

  // if the editor still shows the document of run, makes it editable again and
  // runs edit(); returns false if the document changed
  function editIfSameDocument(run: RunContext, edit: () => void): boolean {
    if (!isSameDocument(run)) {
      return false;
    }
    run.editor.setReadOnly(run.wasReadOnly);
    edit();
    return true;
  }

  // inserts output (starting with a block header) after the active block, or
  // appends it to the note the run started in if the user switched notes
  async function insertRunOutput(run: RunContext, text: string) {
    if (editIfSameDocument(run, () => insertAfterActiveBlock(run.editor.view, text))) {
      return;
    }
    await appendToNote(run.note, text);
    showToast(`Output added to the end of note '${run.note}'`);
  }

  export async function runBoopFunctionWithText(f: BoopFunction, txt: string): Promise<BoopFunctionArg> {
    let input: BoopFunctionArg = {
      text: txt,
      fullText: txt,
      getArgumentsFromUser: (schema: unknown) => getFunctionArguments(f.name, schema),
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

  // inserts output of fdef at cursor position, replacing the selection (#52)
  async function runBoopFunctionAtCursor(run: RunContext, fdef: BoopFunction): Promise<boolean> {
    const view = run.editor.view;
    let sel = getCurrentSelection(view.state);
    // the selection is replaced so it must not include block delimiters
    let { from, to } = rangeInFirstBlock(view.state, sel.from, sel.to);
    const content = view.state.sliceDoc(from, to);
    let res = await boopResult(fdef, content);
    if (res === content) {
      return false;
    }
    let inserted = editIfSameDocument(run, () =>
      view.dispatch({
        changes: { from, to, insert: res },
        selection: { anchor: from + res.length },
        scrollIntoView: true,
        userEvent: "input",
      }),
    );
    if (!inserted) {
      showWarning(`Output of '${fdef.name}' wasn't inserted because the note changed while it was running`);
    }
    return inserted;
  }

  // a selection spanning blocks is limited to its part in the first block (#47)
  async function runBoopFunctionWithSelection(run: RunContext, fdef: BoopFunction, replace: boolean): Promise<boolean> {
    const view = run.editor.view;
    let sel = getCurrentSelection(view.state);
    let { from, to, clipped } = rangeInFirstBlock(view.state, sel.from, sel.to);
    if (clipped) {
      showToast("Selection spans blocks: using only its part in the first block");
    }
    const content = view.state.sliceDoc(from, to);
    let res = await boopResult(fdef, content);
    // TODO: be more intelligent
    if (res === "" || res === content) {
      return false;
    }
    // offsets are only valid if it's still the same document (the editor
    // is read-only while running so it can't be edited)
    let replaced =
      replace &&
      editIfSameDocument(run, () =>
        view.dispatch({
          changes: { from, to, insert: res },
          selection: { anchor: from, head: from + res.length },
          userEvent: "input",
        }),
      );
    if (!replaced) {
      await insertRunOutputBlock(run, res);
    }
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
    if (res === content) {
      // nothing changed (e.g. the user cancelled entering arguments)
      return false;
    }

    // block offsets are only valid if it's still the same document (the editor
    // is read-only while running so it can't be edited)
    let replaced =
      replace &&
      editIfSameDocument(run, () =>
        replaceBlockContent(view, block, res, cursorPos - block.contentFrom, { userEvent: "input" }),
      );
    if (replaced) {
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
      if (isCursorFunction(fdef)) {
        await runBoopFunctionAtCursor(run, fdef);
        logNoteOp("runFunctionAtCursor");
      } else if (onSelection) {
        await runBoopFunctionWithSelection(run, fdef, replace);
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

  function command(label: string, run: Command["run"], options?: Pick<Command, "status" | "paletteLabel">): Command {
    return { label, run, ...options };
  }

  function runAndFocusEditor(run: () => unknown) {
    return () => {
      run();
      focusEditor();
    };
  }

  function buildMenus(): { menu: MenuDef; paletteOnly: Command[] } {
    const name = noteName ?? "";
    const directory = getStorageFS();
    const hasFS = supportsFileSystem();
    const braveNoFS = isBraveWithoutFileSystem();
    const view = editorComp?.getEditorView();
    const readOnly = !view || isReadOnly(view);
    const hasSelectedText = !!view && hasSelection(view.state, true);
    const lang = getLanguage(language);
    const needsWritableEditor = readOnly ? "hidden" : undefined;
    const dev = isDev();

    function blockCommand(label: string, run: Command["run"], status?: Command["status"]): Command {
      return command(label, run, { status, paletteLabel: "Block: " + label });
    }

    function editorAction(run: (editorView: EditorView) => unknown) {
      return runAndFocusEditor(() => run(getEditorView()));
    }

    async function chooseStorage(moveNotes: boolean) {
      if (braveNoFS) {
        showWarning(kBraveEnableFileSystemMsg, 20000);
      } else if (moveNotes) {
        await storeNotesOnDisk();
      } else {
        await runStorageOp(switchToDirectory);
      }
    }

    const storage: MenuDef = [
      { label: directory ? "Current store: directory " + directory.name : "Current store: browser (local storage)" },
      command("Move notes from browser to directory", () => chooseStorage(true), {
        status: directory || (!hasFS && !braveNoFS) ? "hidden" : undefined,
      }),
      command("Switch to browser (local storage)", () => runStorageOp(switchToBrowserStorage), {
        status: !directory || !hasFS ? "hidden" : undefined,
      }),
      command("Switch to notes in a directory", () => chooseStorage(false), {
        status: !hasFS && !braveNoFS ? "hidden" : undefined,
      }),
      { separator: true },
      command("Export all notes to .zip file", exportNotesToZipFile),
      { separator: true },
      command("Help: storage", () => showHTMLHelp("#storing-notes-on-disk")),
    ];

    const encryption: MenuDef = [
      command("Encrypt all notes", openEncryptPassword, { status: hasUnencryptedNotes() ? undefined : "disabled" }),
      command("Decrypt all notes", () => runStorageOp(decryptAllNotes), {
        status: hasEncryptedNotes() ? undefined : "disabled",
      }),
      command("Help: encryption", () => showHTMLHelp("#encryption")),
    ];

    const help: MenuDef = [
      command("Show help", () => showHTMLHelp(), { paletteLabel: "Help" }),
      command("Show help as note", () => openNote(kHelpSystemNoteName), { paletteLabel: "Help as note" }),
      command("Release notes", () => openNote(kReleaseNotesSystemNoteName)),
      command("Show Welcome Note", () => openNote(kWelcomeSystemNoteName)),
    ];
    if (dev) help.push(command("Show Welcome Dev Note", () => openNote(kWelcomeDevSystemNoteName)));

    const note: MenuDef = [
      command("Close tab", runAndFocusEditor(closeCurrentTab), { status: settings.tabs.length < 2 ? "disabled" : undefined }),
      command("Rename", () => (appState.showingRenameNote = true), {
        paletteLabel: "Rename current note",
        status: isProtectedNote(name) ? "disabled" : undefined,
      }),
      command(toggleFavoriteLabel(""), toggleCurrentNoteStar, { paletteLabel: toggleFavoriteLabel("current note ") }),
      command(dailyEntryLabel(), toggleCurrentNoteDailyEntry, {
        paletteLabel: "Note: " + dailyEntryLabel().toLowerCase(),
        status: isSystemNoteName(name) ? "hidden" : undefined,
      }),
      command("Archive", runAndFocusEditor(() => archiveNote(name)), {
        paletteLabel: "Archive note",
        status: !isNoteArchivable(name) || isNoteArchived(name) ? "hidden" : undefined,
      }),
      command("Un-archive", runAndFocusEditor(() => unArchiveNote(name)), {
        paletteLabel: "Un-archive note",
        status: isNoteArchived(name) ? undefined : "hidden",
      }),
      command("Delete permanently", runAndFocusEditor(() => deleteNotePermanently(name, true)), {
        paletteLabel: "Delete note permanently",
        status: canDeleteNote(name) ? undefined : "hidden",
      }),
      command("Export to file", exportCurrentNote, { paletteLabel: "Export current note to a file" }),
    ];

    const block: MenuDef = [
      blockCommand("Go To\tMod + B", () => openBlockSelector()),
      blockCommand("Go To Heading\tMod + Shift + B", openHeadingSelector),
      blockCommand("Markdown preview", toggleMarkdownPreview),
      blockCommand("Toggle read-only", editorAction(toggleBlockReadOnly), needsWritableEditor),
      blockCommand("Add after current\tMod + Enter", editorAction(addNewBlockAfterCurrent)),
      blockCommand("Add before current\tAlt + Enter", editorAction(addNewBlockBeforeCurrent)),
      blockCommand("Add at end\tMod + Shift + Enter", editorAction(addNewBlockAfterLastAndScrollDown)),
      blockCommand("Add at start\tAlt + Shift + Enter", editorAction(addNewBlockBeforeFirst)),
      blockCommand("Split at cursor position\tMod + Alt + Enter", editorAction(insertNewBlockAtCursor)),
      blockCommand("Goto next\tMod + Down", editorAction(gotoNextBlock)),
      blockCommand("Goto previous\tMod + Up", editorAction(gotoPreviousBlock)),
      blockCommand("Move up\tAlt-Mod-Shift-ArrowUp", editorAction(moveCurrentBlockUp)),
      blockCommand("Move down\tAlt-Mod-Shift-ArrowDown", editorAction(moveCurrentBlockDown)),
      blockCommand("Change language\tMod + L", openLanguageSelector),
      blockCommand("Select all text\tMod + A", editorAction(selectAll)),
      blockCommand("Format as " + language + "\tAlt + Shift + F", runAndFocusEditor(formatCurrentBlock),
        readOnly || !lang?.formatType ? "hidden" : undefined),
      command("Export to file", async () => {
        await exportCurrentBlock();
        focusEditor();
      }, { paletteLabel: "Export current block to a file" }),
      blockCommand("Delete", async () => {
        focusEditor();
        await tick();
        deleteBlock(getEditorView());
      }),
      blockCommand("Move to another note", moveCurrentBlock, needsWritableEditor),
      blockCommand("Toggle block fold\tMod + Alt + .", editorAction(toggleBlockFold), needsWritableEditor),
      blockCommand("Fold block\tMod + Alt + [", editorAction(foldBlock), needsWritableEditor),
      blockCommand("Unfold block\tMod + Alt + ]", editorAction(unfoldBlock), needsWritableEditor),
    ];

    const run: MenuDef = [
      command("Smart Run\tMod + E", smartRun, { status: needsWritableEditor }),
      command("Run this block", runCurrentBlock, {
        status: needsWritableEditor ?? (getBlockRunner(language) ? undefined : "disabled"),
      }),
      command("Run this block with another block", runCurrentBlockWithAnotherBlock, {
        status: needsWritableEditor ?? (getBlockRunner(language)?.runWithArgument ? undefined : "disabled"),
      }),
      command("Run this block with clipboard", runCurrentBlockWithClipboard, {
        status: needsWritableEditor ?? (getBlockRunner(language)?.runWithArgument ? undefined : "disabled"),
      }),
      command("Run function with this block\tAlt + Shift + R", () => openFunctionSelector(false), {
        status: needsWritableEditor,
      }),
      command("Run function with selection", () => openFunctionSelector(true), {
        status: needsWritableEditor ?? (hasSelectedText ? undefined : "disabled"),
      }),
      command("Show built-in functions", () => openNote(kBuiltInFunctionsNoteName)),
      command("Create your own functions", openCustomFunctionsNote),
      command("Help", () => showHTMLHelp("#running-code"), { paletteLabel: "Help: running code" }),
    ];

    const menu: MenuDef = [
      command("Command Palette\tMod + Shift + K", openCommandPalette, { paletteLabel: false }),
      command("Open note\tMod + K", openNoteSelector),
      command("New note", openCreateNewNote),
    ];
    if (!isTabHome(settings.currentTab) && view) {
      menu.push(command("Ask AI", openAskAI), { label: "This note", items: note }, { label: "Block", items: block },
        { label: "Run code", items: run });
    }
    menu.push({ label: "Notes storage", items: storage });
    if (directory) menu.push({ label: "Encryption", items: encryption });
    menu.push(command("Settings", openSettings), { label: "Help", items: help },
      { label: "Tip: Ctrl + click for browser's context menu" });

    const paletteOnly: Command[] = [
      command("Create New Scratch Note", async () => {
        await createScratchNote();
        focusEditor();
      }),
      command("Open recent note", openQuickAccess),
      command("Open note in new tab", openNoteSelectorInNewTab),
      command("Toggle Sidebar", () => {
        toggleFlag(settings, "showSidebar");
        if (!settings.showSidebar) focusEditor();
      }),
      command("Find in notes", openFindInNotes),
      command("Search in notes", openFindInNotes),
      command("Open note from disk", openNoteFromDisk, { status: hasFS ? undefined : "hidden" }),
    ];
    if (view) {
      paletteOnly.push(
        command("Find", openFindPanel),
        command("Search", openFindPanel),
        command((isSpellChecking ? "Disable" : "Enable") + " spell checking", runAndFocusEditor(toggleSpellCheck)),
        command("Edit: Insert date\tAlt-Shift-d", editorAction(insertDateAndTime)),
        command("Edit: Insert time\tAlt-Shift-t", editorAction(insertTime)),
      );
    }
    if (view && !readOnly) {
      paletteOnly.push(
        blockCommand("Fold all blocks", editorAction(foldAllBlocks)),
        blockCommand("Unfold all blocks", editorAction(unfoldAllBlocks)),
        command("Edit: Transpose chars", editorAction(transposeChars)),
        command("Edit: Move " + (hasSelectedText ? "selection" : "line") + " up\tAlt-ArrowUp", editorAction(moveLineUp)),
        command("Edit: Move " + (hasSelectedText ? "selection" : "line") + " down\tAlt-ArrowDown", editorAction(moveLineDown)),
        command("Edit: Unfold everything", editorAction(unfoldEverything)),
        command("Edit: Toggle comment\tMod-/", editorAction(toggleComment)),
        command("Edit: Toggle line comment", editorAction(toggleLineComment)),
        command("Edit: Toggle block comment\tAlt-Shift-a", editorAction(toggleBlockComment)),
        command("Edit: Toggle todo checkbox\tMod-Shift-Space", editorAction(toggleCheckbox)),
        command("Edit: Fold code\tMod-Shift-[", editorAction(foldCode)),
        command("Edit: Unfold code\tMod-Shift-]", editorAction(unfoldCode)),
      );
    }
    if (dev) {
      paletteOnly.push(command("Test error tracking", () => {
        console.error("test console error");
        throw new Error("test error from menu");
      }));
    }

    return { menu, paletteOnly };
  }

  function buildMenuDef(): MenuDef {
    return buildMenus().menu;
  }

  function toggleFavoriteLabel(what: string): string {
    const isStarred = !!(noteName && getNoteMeta(noteName)?.isStarred);
    return isStarred ? `Remove ${what}from favorites` : `Add ${what}to favorites`;
  }

  function dailyEntryLabel(): string {
    return noteName && noteHasDailyEntry(noteName) ? "Stop adding a block for today" : "Add a block for today when opened";
  }

  function editorHasSelection(): boolean {
    return hasSelection(getEditorView().state, true);
  }

  function openFindPanel() {
    openSearchPanel(getEditorView());
  }

  async function executeCommand(run: Command["run"]) {
    appState.showingContextMenu = false;
    appState.showingCommandPalette = false;
    await run();
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

  function commandPaletteCommands(): Command[] {
    const { menu, paletteOnly } = buildMenus();
    const commands: Command[] = [];

    function collect(items: MenuDef) {
      for (const item of items) {
        if ("items" in item && item.items) {
          collect(item.items);
        } else if ("run" in item && !item.status && item.paletteLabel !== false) {
          commands.push({ ...item, label: item.paletteLabel ?? item.label });
        }
      }
    }

    collect(menu);
    collect(paletteOnly);
    return commands;
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
    appState.showingCommandPalette = true;
  }

  function getEditorComp(): Editor {
    return editorComp;
  }

  function getEditor(): MultiBlockEditor {
    return editorComp.getEditor();
  }

  function getEditorView(): EditorView {
    return getEditor().view;
  }

  function formatCurrentBlock() {
    formatBlockContent(getEditor());
    logNoteOp("noteFormatBlock");
  }

  function toggleCurrentNoteStar() {
    toggleNoteStarred(noteName!);
    getEditor().focus();
  }

  async function toggleCurrentNoteDailyEntry() {
    let name = noteName!;
    let on = !noteHasDailyEntry(name);
    await setNoteDailyEntry(name, on);
    if (noteName !== name || !editorComp) return;
    let editor = getEditor();
    if (on) {
      autoCreateDayInJournal(editor);
    }
    editor.focus();
  }

  // returns false if the response couldn't be inserted
  function insertAskAIResponse(s: string): boolean {
    const view = editorComp?.getEditorView();
    if (!view || isReadOnly(view)) {
      return false;
    }
    let text = blockHdrMarkdown + s;
    return insertAfterActiveBlock(view, text);
  }

  export async function runBlockContent(editor: MultiBlockEditor, argument?: string): Promise<boolean> {
    const { state } = editor.view;
    const block = getEditableActiveBlock(state);
    if (!block) return false;

    const runner = getBlockRunner(block.language);
    const runWithArgument = runner?.runWithArgument;
    const evaluate = argument === undefined ? runner?.run : runWithArgument && ((code: string) => runWithArgument(code, argument));
    if (!evaluate) return false;

    const content = blockContentText(state, block);
    const result = await withRun(editor, async (run) => {
      showModalMessageHTML("running code", 300, "run");
      const result = await evaluate(content);
      const output = evalResultToString(result) || "executed code returned empty output";
      await insertRunOutputBlock(run, output);
      return true;
    });
    return !!result;
  }

  function runCurrentBlock() {
    let editor = getEditor();
    runAndFocus(editor, () => runBlockContent(editor), "runBlock");
  }

  function runBlockWithAnotherBlock(block: NoteBlock) {
    closeDialogs();
    let n = block.index;
    let editor = getEditor();
    let state = editor.view.state;
    let blockArg = getBlockN(state, n);
    let arg = blockContentText(state, blockArg);
    runAndFocus(editor, () => runBlockContent(editor, arg), "runBlockWithBlock");
  }

  // starts run() (running code of the current block), focuses the editor and logs logOp
  function runAndFocus(editor: MultiBlockEditor, run: () => unknown, logOp: string) {
    run();
    editor.focus();
    logNoteOp(logOp);
  }

  function canRunBlockWithArgument(state: EditorState): boolean {
    const block = getEditableActiveBlock(state);
    return !!block && !!getBlockRunner(block.language)?.runWithArgument;
  }

  function runCurrentBlockWithAnotherBlock() {
    if (canRunBlockWithArgument(getEditorView().state)) {
      openBlockSelector(runBlockWithAnotherBlock);
    }
  }

  async function runCurrentBlockWithClipboard() {
    const editor = getEditor();
    const { state } = editor.view;
    const { contentGen } = editor;
    if (!canRunBlockWithArgument(state)) return;

    const arg = await getClipboardText();
    if (editorComp?.getEditor() === editor && editor.contentGen === contentGen && editor.view.state === state) {
      runAndFocus(editor, () => runBlockContent(editor, arg), "runBlockWithClipboard");
    }
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
    // the old name no longer exists: replace its browser history entry (#54).
    // renameNote() already renamed it in our own history
    if (await openNote(newName, true, true)) {
      addNoteToBrowserHistory(newName, true);
    }
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
    focusEditor();
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
    const view = editorComp?.getEditorView();
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
    const editor = getEditor();
    const { view, contentGen } = editor;
    const { state } = view;
    const block = getEditableActiveBlock(state);
    if (!block) return;
    try {
      await appendToNote(name, state.sliceDoc(block.from, block.to));
    } catch (e) {
      // e.g. invalid name or a system note: the block stays where it is
      showError(`${e}`);
      return;
    }
    if (editorComp?.getEditor() !== editor || editor.contentGen !== contentGen || view.state.doc !== state.doc || !deleteBlock(view, block)) {
      showWarning("Copied the block. The original could not be removed because the source note changed.");
      return;
    }
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
    updateMarkdownPreview();
  }

  // floating preview of the markdown block with the cursor (#49)
  let showingMarkdownPreview = $state(false);
  let previewMarkdown: string | null = $state(null);

  function updateMarkdownPreview() {
    if (!showingMarkdownPreview) {
      return;
    }
    const view = editorComp?.getEditorView();
    let block = view ? getActiveNoteBlock(view.state) : undefined;
    previewMarkdown = block?.language === "markdown" ? view!.state.sliceDoc(block.contentFrom, block.to) : null;
  }

  function toggleMarkdownPreview() {
    showingMarkdownPreview = !showingMarkdownPreview;
    updateMarkdownPreview();
    focusEditor();
  }

  function updateDocSize() {
    let editor = getEditor();
    const c = editor.getContent() || "";
    docSize = stringSizeInUtf8Bytes(c);
  }

  function autoCreateDayInJournal(editor: MultiBlockEditor) {
    // create block for a current day if doesn't exist
    const s = blockHdrMarkdown + "# " + formatDateYYYYMMDDDay();
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
    updateMarkdownPreview();
    if (noteHasDailyEntry(name) && !readOnly) {
      autoCreateDayInJournal(editor);
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
    updateMarkdownPreview();
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
  <TopNav openNote={onOpenNote} {closeTab} {openNoteSelector} {openNoteSelectorInNewTab} {executeCommand} {buildMenuDef} />
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

{#if showingBlockSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <BlockSelector
      items={selectorItems}
      onselect={onSelectorPick}
      noun={selectorNoun}
      initialSelection={initialBlockSelection}
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
{#if modalMessageState.isShowing && !appState.showingDecryptPassword && !appState.showingAskFileWritePermissions && !argsRequest}
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
    <CommandPalette commandsDef={commandPaletteCommands()} {executeCommand} {switchToNoteSelector} />
  </Overlay>
{/if}

{#if appState.showingContextMenu}
  <Overlay onclose={closeDialogs}>
    <Menu {executeCommand} menuDef={contextMenuDef} pos={contextMenuPos} />
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

{#if showingMarkdownPreview && !isTabHome(settings.currentTab)}
  <MarkdownPreview markdown={previewMarkdown} onclose={toggleMarkdownPreview} />
{/if}

{#if argsRequest}
  <Overlay onclose={() => answerFunctionArguments(null)} blur={true}>
    <FunctionArgsDialog title={argsRequest.title} specs={argsRequest.specs} onanswer={answerFunctionArguments}
    ></FunctionArgsDialog>
  </Overlay>
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
