<script lang="ts">
  import { tick } from "svelte";
  import { toggleBlockComment, toggleComment, toggleLineComment } from "@codemirror/commands";
  import { foldCode, unfoldCode } from "@codemirror/language";
  import { closeSearchPanel, openSearchPanel, searchPanelOpen } from "@codemirror/search";
  import { EditorSelection, EditorState } from "@codemirror/state";
  import type { EditorView } from "@codemirror/view";
  import { appState, appStateUpdateAfterNotesChange } from "../appstate.svelte";
  import {
    blockHdrMarkdown,
    kBuiltInFunctionsNoteName,
    kDailyJournalNoteName,
    kEdnaFileExt,
    kHelpSystemNoteName,
    kMyFunctionsNoteName,
    kReleaseNotesSystemNoteName,
    kScratchNoteName,
    kWelcomeDevSystemNoteName,
    kWelcomeSystemNoteName,
  } from "../constants";
  import { ADD_NEW_BLOCK, heynoteEvent } from "../editor/annotation";
  import { getActiveNoteBlock, getBlockN, getBlocksInfo, insertAfterActiveBlock } from "../editor/block/block";
  import type { NoteBlock } from "../editor/block/block-parsing";
  import {
    addNewBlockAfterCurrent,
    addNewBlockAfterLast,
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
  import { getCurrentSelection, isReadOnly } from "../editor/cmutils";
  import { insertDateAndTime, insertTime } from "../editor/date-time";
  import { MultiBlockEditor } from "../editor/editor";
  import type { KeymapSpec } from "../editor/editor";
  import type { SelectionChangeEvent } from "../editor/event";
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
  import { fsFileHandleWriteBlob, hasHandlePermission, openDirPicker, supportsFileSystem } from "../fileutil";
  import { formatBlockContent } from "../format-code";
  import { parseUserFunctions, runBoopFunction } from "../functions";
  import type { BoopFunction, BoopFunctionArg } from "../functions";
  import { setGlobalFuncs } from "../globals";
  import { addNoteToHistory } from "../history";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import { boot } from "../main";
  import {
    archiveNote,
    getNoteMeta,
    getNotesMetadata,
    isNoteArchived,
    toggleNoteStarred,
    unArchiveNote,
  } from "../metadata";
  import { isMoving } from "../mouse-track.svelte";
  import {
    appendToNote,
    canDeleteNote,
    createIfNotExists,
    createNewScratchNote,
    createNoteWithName,
    dbDelDirHandle,
    debugRemoveLocalStorageNotes,
    decryptAllNotes,
    deleteNote,
    encryptAllNotes,
    getStorageFS,
    isNoteArchivable,
    isSystemNoteName,
    isUsingEncryption,
    loadNoteIfExists,
    noteExists,
    pickAnotherDirectory,
    preLoadAllNotes,
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
    addNoteToBrowserHistory,
    formatDateYYYYMMDDDay,
    getClipboardText,
    isAltNumEvent,
    isDev,
    len,
    noOp,
    platform,
    stringSizeInUtf8Bytes,
    throwIf,
    trimPrefix,
    trimSuffix,
  } from "../util";
  import AskAI from "./AskAI.svelte";
  import AskFileWritePermissions from "./AskFileWritePermissions.svelte";
  import BlockSelector from "./BlockSelector.svelte";
  import type { Item as BlockItem } from "./BlockSelector.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import CreateNewNote from "./CreateNewNote.svelte";
  import EnterDecryptPassword from "./EnterDecryptPassword.svelte";
  import EnterEncryptPassword from "./EnterEncryptPassword.svelte";
  import FindInNotes from "./FindInNotes.svelte";
  import FunctionSelector from "./FunctionSelector.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import Menu, {
    kMenuIdJustText,
    kMenuSeparator,
    kMenuStatusDisabled,
    kMenuStatusNormal,
    kMenuStatusRemoved,
  } from "./Menu.svelte";
  import type { MenuDef, MenuItemDef } from "./Menu.svelte";
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
  import Toaster, { showError, showToast, showWarning } from "./Toaster.svelte";
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
  let noteName = $derived(settings.currentNoteName);
  let selectionSize = $state(0);

  let showingContextMenu = $state(false);
  let showingLanguageSelector = $state(false);
  let showingNoteSelector = $state(false);
  let showingBlockMoveSelector = $state(false);
  let showingCommandPalette = $state(false);
  let showingFunctionSelector = $state(false);
  let showingSettings = $state(false);
  let showingRenameNote = $state(false);
  let showingBlockSelector = $state(false);
  let showingFindInNotes = $state(false);
  let showingDecryptPassword = $state(false);
  let showingDecryptMessage = $state("");
  let showingAskFileWritePermissions = $state(false);
  let showingAskAI = $state(false);

  let isShowingDialog = $derived.by(() => {
    return (
      showingContextMenu ||
      showingLanguageSelector ||
      showingNoteSelector ||
      showingBlockMoveSelector ||
      showingCommandPalette ||
      appState.showingCreateNewNote ||
      showingFunctionSelector ||
      showingSettings ||
      showingRenameNote ||
      appState.showingQuickAccess ||
      showingBlockSelector ||
      showingFindInNotes ||
      showingDecryptPassword ||
      showingEncryptPassword ||
      showingAskFileWritePermissions
    );
  });

  function closeDialogs() {
    showingContextMenu = false;
    showingLanguageSelector = false;
    showingNoteSelector = false;
    showingBlockMoveSelector = false;
    showingCommandPalette = false;
    appState.showingCreateNewNote = false;
    showingFunctionSelector = false;
    showingSettings = false;
    showingRenameNote = false;
    appState.showingQuickAccess = false;
    showingBlockSelector = false;
    showingFindInNotes = false;
    showingAskAI = false;

    appState.forceNewTab = false;

    getEditorComp().focus();
  }

  let isSpellChecking = $state(false);

  let functionContext = $state("");
  let runFunctionOnSelection = false;
  let userFunctions: BoopFunction[] = $state([]); // note: $state() not needed
  let contextMenuPos = $state({ x: 0, y: 0 });

  let askAIStartText = $state("");

  // /** @type {import("../editor/editor").EdnaEditor} */
  // let ednaEditor = $state(null);

  let editorRef: Editor;

  $effect(() => {
    isMoving.disableMoveTracking = isShowingDialog;
  });

  function openFindInNotes() {
    showingFindInNotes = true;
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

  // External keymap bindings that require App-level functions
  let extraKeymap: KeymapSpec = [
    ["Alt-Shift-f", () => formatBlockContent(getEditor())],
    ["Mod-l", openLanguageSelector],
    ["Mod-e", smartRun],
    ["Alt-Shift-r", () => openFunctionSelector(false)],
    ["Mod-b", () => openBlockSelector()],
    ["Mod-k", openNoteSelector],
    ["Mod-o", openNoteSelector],
    ["Mod-p", openNoteSelector],
    ["Mod-Shift-p", openCommandPalette],
    ["Mod-Shift-k", openCommandPalette],
    ["Mod-Shift-o", openCommandPalette],
    ["Mod-h", openQuickAccess],
    ["Mod-Shift-f", openFindInNotes],
  ];
  // Alt-n for create scratch note only on non-Mac (Option-n is used for accented characters on Mac)
  if (!isMac) {
    extraKeymap.push(["Alt-n", createScratchNote]);
  }

  $effect(() => {
    getEditorComp().setSpellChecking(isSpellChecking);
  });

  function focusEditor() {
    getEditor().focus();
  }

  $effect(() => {
    // console.log("App.svelte did mount");
    // capture: true so that we get those before codemirror can process it
    window.addEventListener("keydown", onKeyDown, { capture: true });

    window.addEventListener("beforeunload", async (ev) => {
      if (appState.isDirty) {
        // show a dialog that the content might be lost
        ev.preventDefault();
        // @ts-ignore
        ev.returnValue = true;
      } else {
        logAppExit();
      }
    });

    window.addEventListener("popstate", function (ev) {
      let state = ev.state;
      if (!state || !state.noteName) {
        console.log("popstate: state is null or has no 'noteName' field:", state);
        return;
      }
      let name = state.noteName;
      console.log("popstate:", name, state);
      if (name === noteName) {
        console.log("smae as noteName, nothing to do");
        return;
      }
      if (!noteExists(name)) {
        console.log(`Note with name '${name}' doesn't exist`);
        return;
      }
      openNote(name, false /* skip save */, true /* noPushHistory */);
    });

    logAppOpen();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  function onKeyDown(ev: KeyboardEvent) {
    // we bind Mod-h in CocdeMirror which only works if CodeMirror has
    // focus. We have to prevent it here to disable the default
    // behavior of hiding a window
    if (ev.key == "h") {
      if (ev.ctrlKey || ev.metaKey) {
        if (isShowingDialog) {
          ev.preventDefault();
          if (appState.showingQuickAccess) {
            appState.showingQuickAccess = false;
            getEditor().focus();
          }
        }
        return;
      }
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
        isMoving.disableMoveTracking = false;
        closeSearchPanel(view);
        return;
      }
      return;
    }

    // if (ev.key === "F2") {
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

  function noOpStr(s: string): void {
    // do nothing
  }
  let closeDecryptPassword: () => void = $state(noOp);
  let onDecryptPassword: (pwd: string) => void = $state(noOpStr);

  async function getPasswordFromUser(msg: string = ""): Promise<string> {
    showingDecryptPassword = true;
    showingDecryptMessage = msg;
    clearModalMessage();
    return new Promise((resolve, reject) => {
      onDecryptPassword = (pwd: string) => {
        resolve(pwd);
        showingDecryptPassword = false;
      };
      closeDecryptPassword = () => {
        resolve("");
        showingDecryptPassword = false;
      };
    });
  }

  function noOpBool(v: boolean): void {
    // do nothing
  }
  let fileWritePermissionsFileHandle: FileSystemFileHandle | undefined = $state();
  let askFileWritePermissionsClose: (ok: boolean) => void = $state(noOpBool);

  async function requestFileWritePermission(fh: FileSystemFileHandle): Promise<boolean> {
    if (await hasHandlePermission(fh, true)) {
      console.log("requestFileWritePermission: already have write permissions to", fh);
      return true;
    }
    fileWritePermissionsFileHandle = fh;
    showingAskFileWritePermissions = true;
    clearModalMessage();
    return new Promise((resolve, reject) => {
      askFileWritePermissionsClose = (ok) => {
        console.log("requestFileWritePermission: ok", ok);
        showingAskFileWritePermissions = false;
        resolve(ok);
      };
    });
  }

  let showingEncryptPassword = $state(false);
  function openEncryptPassword() {
    showingEncryptPassword = true;
  }

  function closeEncryptPassword() {
    showingEncryptPassword = false;
    let view = getEditorView();
    view.focus();
  }

  function onEncryptPassword(pwd: string) {
    console.log("got encryption password:", pwd);
    closeEncryptPassword();
    encryptAllNotes(pwd);
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
    for (let fh of fileHandles) {
      console.log("fh:", fh);
      let noteName = rememberOpenedNote(fh);
      if (noteName === null || noteName === "") {
        continue;
      }
      // will open the first selected note
      if (noteToOpen === null) {
        noteToOpen = noteName;
      }
    }
    if (noteToOpen) {
      openNote(noteToOpen);
    }
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
    await fsFileHandleWriteBlob(fh, blob);
  }

  async function exportCurrentBlock() {
    let settings = getSettings();
    let editor = getEditor();
    let bi = getBlocksInfo(editor.view.state);
    let block = getActiveNoteBlock(editor.view.state)!;
    let ext = extForLang(block.language);
    let name = toFileName(settings.currentNoteName) + `-${bi.active}.` + ext;
    let from = block.contentFrom,
      to = block.to;
    let s = editor.view.state.sliceDoc(from, to);
    console.log("exportCurrentBlock:", name);
    const blob = new Blob([s], { type: "text/plain" });
    await exportBlobToFile(blob, name);
  }

  async function exportCurrentNote() {
    let settings = getSettings();
    let fileName = toFileName(settings.currentNoteName) + kEdnaFileExt;
    let editor = getEditor();
    let s = editor.getContent();
    console.log("exportCurrentNote:", fileName);
    const blob = new Blob([s], { type: "text/plain" });
    await exportBlobToFile(blob, fileName);
  }

  function openSettings() {
    showingSettings = true;
  }

  async function createScratchNote() {
    let name = await createNewScratchNote();
    await onOpenNote(name);
    // TODO: add a way to undo creation of the note
    showToast(`Created scratch note '${name}'`);
    logNoteOp("noteCreate");
  }

  async function switchToBrowserStorage() {
    console.log("switchToBrowserStorage(): deleting dir handle");
    await dbDelDirHandle();
    await boot();
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
    let blocks = editor.getBlocks();
    let activeBlock = getActiveNoteBlock(editor.view.state);
    let content = editor.getContent();
    let items: BlockItem[] = [];
    let blockNo = 0;
    let currBlockNo = 0;
    for (let b of blocks) {
      let title = extractBlockTitle(content, b.contentFrom, b.to);
      let bi = {
        block: b,
        text: title,
        key: blockNo,
      };
      items.push(bi);
      if (b == activeBlock) {
        currBlockNo = blockNo;
      }
      blockNo++;
    }
    blockItems = items;
    initialBlockSelection = currBlockNo;
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
    showingCommandPalette = false;
    openNoteSelector();
  }

  function switchToCommandPalette() {
    showingNoteSelector = false;
    openCommandPalette();
  }

  function openNoteSelector() {
    showingNoteSelector = true;
  }

  function reOpenNoteSelector() {
    showingNoteSelector = false;
    tick().then(() => {
      showingNoteSelector = true;
    });
  }

  function switchToWideNoteSelector() {
    settings.useWideSelectors = true;
    reOpenNoteSelector();
  }

  async function switchToRegularNoteSelector() {
    settings.useWideSelectors = false;
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
    showingFunctionSelector = true;
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

  async function runBoopFunctionWithSelection(
    view: EditorView,
    fdef: BoopFunction,
    replace: boolean,
  ): Promise<boolean> {
    // TOOD: selection can cross blocks so for now not implementing replace
    replace = false;

    const { state } = view;
    if (state.readOnly) return false;
    let { selectedText } = getCurrentSelection(state);
    const content = selectedText;
    let res = "";
    let input = null;
    try {
      input = await runBoopFunctionWithText(fdef, content);
      res = "";
      if (input.text != content) {
        res = input.text;
      }
      if (input.fullText != content) {
        res = input.fullText;
      }
      console.log("res:", res);
    } catch (e) {
      console.log(e);
      res = `error running ${fdef.name}: ${e}`;
    }

    if (replace) {
      throwIf(true, "not yet implemented");
    } else {
      // TODO: be more intelligent
      if (res === "") {
        return false;
      }
      let text = res;
      if (!res.startsWith("\n∞∞∞")) {
        text = "\n∞∞∞text-a\n" + res;
      }
      insertAfterActiveBlock(view, text);
    }
    return true;
  }

  async function runBoopFunctionWithBlockContent(
    view: EditorView,
    fdef: BoopFunction,
    replace: boolean,
  ): Promise<boolean> {
    const { state } = view;
    if (state.readOnly) return false;
    const block = getActiveNoteBlock(state)!;
    console.log("editorRunBlockFunction:", block);
    const cursorPos = state.selection.asSingle().ranges[0].head;
    const content = state.sliceDoc(block.contentFrom, block.to);
    let res = "";
    let input = null;
    try {
      input = await runBoopFunctionWithText(fdef, content);
      res = content;
      if (input.text != content) {
        res = input.text;
      }
      if (input.fullText != content) {
        res = input.fullText;
      }
      console.log("res:", res);
    } catch (e) {
      console.log(e);
      res = `error running ${fdef.name}: ${e}`;
    }

    if (replace) {
      let cursorOffset = cursorPos - block.contentFrom;
      const tr = view.state.update(
        {
          changes: {
            from: block.contentFrom,
            to: block.to,
            insert: res,
          },
          selection: EditorSelection.cursor(block.contentFrom + Math.min(cursorOffset, res.length)),
        },
        {
          userEvent: "input",
          scrollIntoView: true,
        },
      );
      view.dispatch(tr);
    } else {
      // TODO: be more intelligent
      let text = res;
      if (!res.startsWith("\n∞∞∞")) {
        text = "\n∞∞∞text-a\n" + res;
      }
      insertAfterActiveBlock(view, text);
    }
    return true;
  }

  async function runFunction(fdef: BoopFunction, replace: boolean) {
    console.log("runFunction");
    showingFunctionSelector = false;
    let view = getEditorView();
    if (isReadOnly(view)) {
      view.focus();
      return;
    }
    let name = fdef.name;
    let msg = `Running <span class="font-bold">${name}</span>...`;
    showModalMessageHTML(msg, 300);
    if (runFunctionOnSelection) {
      await runBoopFunctionWithSelection(view, fdef, replace);
      logNoteOp("runFunctionWithSelection");
    } else {
      await runBoopFunctionWithBlockContent(view, fdef, replace);
      logNoteOp("runFunction");
    }
    clearModalMessage();
    view.focus();
  }

  function openLanguageSelector() {
    showingLanguageSelector = true;
  }

  function onSelectLanguage(lang: string) {
    showingLanguageSelector = false;
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
  const kCmdOpenFind = nmid();
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
  const kCmdToggleSpellChecking2 = nmid();
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

  function buildMenuDef(): MenuDef {
    // let starAction = "Star";
    let starAction = "Add to favorites";
    let meta = getNoteMeta(noteName);
    if (meta && meta.isStarred) {
      //starAction = "Un-star";
      starAction = "Remove from favorites";
    }

    const menuNote: MenuItemDef[] = [
      ["Close tab", kCmdCloseCurrentTab],
      ["Rename", kCmdRenameCurrentNote],
      [starAction, kCmdNoteToggleStarred],
      ["Archive", kCmdArchiveCurrentNote],
      ["Un-archive", kCmdUnArchiveCurrentNote],
      ["Delete permanently", kCmdPermanentlyDeleteNote],
      ["Export to file", kCmdExportCurrentNote],
    ];

    const menuBlock: MenuItemDef[] = [
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
      ...(isMac
        ? ([
            ["Toggle block fold\tMod + Alt + .", kCmdToggleBlockFold],
            ["Fold block\tMod + Alt + [", kCmdFoldBlock],
            ["Unfold block\tMod + Alt + ]", kCmdUnfoldBlock],
          ] as MenuItemDef[])
        : ([
            ["Toggle block fold\tCtrl + Alt + .", kCmdToggleBlockFold],
            ["Fold block\tCtrl + Alt + [", kCmdFoldBlock],
            ["Unfold block\tCtrl + Alt + ]", kCmdUnfoldBlock],
          ] as MenuItemDef[])),
    ];

    const menuRun: MenuItemDef[] = [
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

    let dh = getStorageFS();
    let currStorage = "Current store: browser (local storage)";
    if (dh) {
      currStorage = `Current store: directory ${dh.name}`;
    }
    const menuStorage: MenuItemDef[] = [
      [currStorage, kMenuIdJustText],
      ["Move notes from browser to directory", kCmdMoveNotesToDirectory],
      ["Switch to browser (local storage)", kCmdSwitchToLocalStorage],
      ["Switch to notes in a directory", kCmdSwitchToNotesInDir],
      kMenuSeparator,
      ["Export all notes to .zip file", kCmdExportNotes],
      kMenuSeparator,
      ["Help: storage", kCmdShowStorageHelp],
    ];

    const menuEncrypt: MenuItemDef[] = [
      ["Encrypt all notes", kCmdEncryptNotes],
      ["Decrypt all notes", kCmdDecryptNotes],
      ["Help: encryption", kCmdEncryptionHelp],
    ];

    const menuHelp: MenuItemDef[] = [
      ["Show help", kCmdShowHelp],
      ["Show help as note", kCmdShowHelpAsNote],
      ["Release notes", kCmdShowReleaseNotes],
      ["Show Welcome Note", kCmdShowWelcomeNote],
    ];

    if (isDev()) {
      menuHelp.push(["Show Welcome Dev Note", kCmdShowWelcomeDevNote]);
    }

    const contextMenu: MenuDef = [
      ["Command Palette\tMod + Shift + K", kCmdCommandPalette],
      ["Open note\tMod + K", kCmdOpenNote],
      ["New note", kCmdCreateNewNote],
      ["Ask AI", kCmdAskAI],
      // ["Find\tMod + Q", kCmdOpenFind],
      ["This note", menuNote],
      ["Block", menuBlock],
      ["Run code", menuRun],
      ["Notes storage", menuStorage],
    ];
    if (dh) {
      // encryption only for files stored on disk
      contextMenu.push(["Encryption", menuEncrypt]);
    }
    contextMenu.push(
      ["Settings", kCmdSettings],
      ["Help", menuHelp],
      ["Tip: Ctrl + click for browser's context menu", kMenuIdJustText],
    );

    return contextMenu;
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

  const commandPaletteAdditions: MenuItemDef[] = [
    ["Test error tracking", kCmdTestErrorTracking],
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
    ["Toggle Spellchecking", kCmdToggleSpellChecking2],
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
    // ["Export current note", kCmdExportCurrentNote],
    // @ts-ignore
    ...(isMac
      ? [
          ["Edit: Fold code\tMod-Shift-[", kCmdFoldCode],
          ["Edit: Unfold code\tMod-Shift-]", kCmdUnfoldColde],
        ]
      : [
          ["Edit: Fold code\tCtrl-Shift-[", kCmdFoldCode],
          ["Edit: Unfold code\tCtrl-Shift-]", kCmdUnfoldColde],
        ]),
  ];

  function menuItemStatus(mi: MenuItemDef): number {
    let mid = mi[1] as number;
    if (mid === kMenuIdJustText) {
      return kMenuStatusDisabled;
    }
    let noteName = settings.currentNoteName;
    // console.log("menuItemStatus:", mi);
    // console.log("s:", s, "mid:", mid);
    // note: this is called for each menu item so should be fast
    let lang = getLanguage(language)!;
    let dh = getStorageFS();
    // console.log("dh:", dh);
    let hasFS = supportsFileSystem();
    let view = getEditorView();
    let readOnly = isReadOnly(view);
    let hasSel = hasSelection();

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
    } else if (mid === kCmdRunBlockWithAnotherBlock) {
      if (lang.token !== "javascript") {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdRunBlockWithClipboard) {
      if (lang.token !== "javascript") {
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
      if (dh === null) {
        // currently using local storage
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdEncryptNotes) {
      return isUsingEncryption() ? kMenuStatusDisabled : kMenuStatusNormal;
    } else if (mid === kCmdDecryptNotes) {
      return isUsingEncryption() ? kMenuStatusNormal : kMenuStatusDisabled;
    } else if (mid === kCmdRenameCurrentNote) {
      if (noteName === kScratchNoteName) {
        return kMenuStatusDisabled;
      }
      if (isSystemNoteName(noteName)) {
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

  function hasSelection(): boolean {
    let view = getEditorView();
    let { selectedText } = getCurrentSelection(view.state);
    return selectedText != "";
  }

  function openFindPanel() {
    let view = getEditorView();
    openSearchPanel(view);
  }

  async function onmenucmd(cmdId: number) {
    // console.log("cmd:", cmdId);
    showingContextMenu = false;
    let view = getEditorView();
    let ednaEditor = getEditor();

    if (cmdId === kCmdCommandPalette) {
      openCommandPalette();
    } else if (cmdId === kCmdOpenNote) {
      openNoteSelector();
    } else if (cmdId === kCmdOpenNoteInNewTab) {
      appState.forceNewTab = true;
      openNoteSelector();
    } else if (cmdId === kCmdOpenFind) {
      // TODO: open search panel
    } else if (cmdId === kCmdCreateNewNote) {
      openCreateNewNote();
      view.focus();
    } else if (cmdId === kCmdCloseCurrentTab) {
      closeCurrentTab();
      view.focus();
    } else if (cmdId === kCmdRenameCurrentNote) {
      showingRenameNote = true;
    } else if (cmdId == kCmdPermanentlyDeleteNote) {
      deleteNotePermanently(settings.currentNoteName, true);
      view.focus();
    } else if (cmdId === kCmdArchiveCurrentNote) {
      archiveNote(settings.currentNoteName);
      view.focus();
    } else if (cmdId === kCmdUnArchiveCurrentNote) {
      unArchiveNote(settings.currentNoteName);
      view.focus();
    } else if (cmdId === kCmdCreateScratchNote) {
      await createScratchNote();
      view.focus();
    } else if (cmdId === kCmdNewBlockAfterCurrent) {
      addNewBlockAfterCurrent(view);
      view.focus();
    } else if (cmdId === kCmdNewBlockBeforeCurrent) {
      addNewBlockBeforeCurrent(view);
      view.focus();
    } else if (cmdId === kCmdNewBlockAtEnd) {
      addNewBlockAfterLast(view);
      view.focus();
    } else if (cmdId === kCmdNewBlockAtStart) {
      addNewBlockBeforeFirst(view);
      view.focus();
    } else if (cmdId === kCmdSplitBlockAtCursor) {
      insertNewBlockAtCursor(view);
      view.focus();
    } else if (cmdId === kCmdGoToBlock) {
      openBlockSelector();
    } else if (cmdId === kCmdGoToNextBlock) {
      gotoNextBlock(view);
      view.focus();
    } else if (cmdId === kCmdTransposeChars) {
      transposeChars(view);
      view.focus();
    } else if (cmdId === kCmdToggleComment) {
      toggleComment(view);
      view.focus();
    } else if (cmdId === kCmdToggleLineComment) {
      toggleLineComment(view);
      view.focus();
    } else if (cmdId === kCmdToggleBlockComment) {
      toggleBlockComment(view);
      view.focus();
    } else if (cmdId === kCmdInsertDateAndTime) {
      insertDateAndTime(view);
      view.focus();
    } else if (cmdId === kCmdInsertTime) {
      insertTime(view);
      view.focus();
    } else if (cmdId === kCmdGoToPreviousBlock) {
      gotoPreviousBlock(view);
      view.focus();
    } else if (cmdId === kCmdMoveBlockUp) {
      moveCurrentBlockUp(view);
      view.focus();
    } else if (cmdId === kCmdMoveBlockDown) {
      moveCurrentBlockDown(view);
      view.focus();
    } else if (cmdId === kCmdChangeBlockLanguage) {
      openLanguageSelector();
    } else if (cmdId === kCmdBlockSelectAll) {
      selectAll(view);
      view.focus();
    } else if (cmdId === kCmdFormatBlock) {
      formatCurrentBlock();
      view.focus();
    } else if (cmdId === kCmdMoveBlock) {
      moveCurrentBlock();
    } else if (cmdId === kCmdFoldCode) {
      foldCode(view);
      view.focus();
    } else if (cmdId === kCmdUnfoldColde) {
      unfoldCode(view);
      view.focus();
    } else if (cmdId === kCmdFoldBlock) {
      foldBlock(ednaEditor)(view);
      view.focus();
    } else if (cmdId === kCmdUnfoldBlock) {
      unfoldBlock(ednaEditor)(view);
      view.focus();
    } else if (cmdId === kCmdMoveLineUp || cmdId === kCmdMoveSelectionUp) {
      moveLineUp(view);
      view.focus();
    } else if (cmdId === kCmdMoveLineDown || cmdId === kCmdMoveSelectionDown) {
      moveLineDown(view);
      view.focus();
    } else if (cmdId === kCmdFoldAllBlocks) {
      foldAllBlocks(ednaEditor)(view);
      view.focus();
    } else if (cmdId === kCmdUnfoldAllBlocks) {
      unfoldAlBlocks(ednaEditor)(view);
      view.focus();
    } else if (cmdId === kCmdUnfoldEverything) {
      unfoldEverything(ednaEditor)(view);
      view.focus();
    } else if (cmdId === kCmdToggleBlockFold) {
      toggleBlockFold(ednaEditor)(view);
      view.focus();
    } else if (cmdId === kCmdExportCurrentBlock) {
      await exportCurrentBlock();
      view.focus();
    } else if (cmdId === kCmdBlockDelete) {
      view.focus();
      tick().then(() => {
        deleteBlock(ednaEditor)(view);
      });
    } else if (cmdId === kCmdOpenNoteFromDisk) {
      openNoteFromDisk();
    } else if (cmdId === kCmdAskAI) {
      openAskAI();
    } else if (cmdId === kCmdToggleSpellChecking) {
      toggleSpellCheck();
      view.focus();
    } else if (cmdId === kCmdToggleSpellChecking2) {
      toggleSpellCheck();
      view.focus();
    } else if (cmdId === kCmdShowHelp) {
      showHTMLHelp();
      view.focus();
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
      await pickAnotherDirectory2();
    } else if (cmdId === kCmdSwitchToLocalStorage) {
      await switchToBrowserStorage();
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
      decryptAllNotes();
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
      settings.showSidebar = !settings.showSidebar;
      if (!settings.showSidebar) {
        view.focus();
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
    console.log("contextmenu: ", ev);
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
    showingContextMenu = true;
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
      let starAction = "Add current note to favorites";
      let meta = getNoteMeta(noteName);
      if (meta && meta.isStarred) {
        //starAction = "Un-star";
        starAction = "Remove current note from favorites";
      }
      return starAction;
    }
    return name || "";
  }

  function buildCommandsDef(): MenuItemDef[] {
    let a: MenuItemDef[] = [];
    function addMenuItems(items: MenuItemDef[]) {
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
        let el: MenuItemDef = [name, id];
        a.push(el);
      }
    }
    let mdef = buildMenuDef();
    addMenuItems(mdef);
    return a;
  }

  let commandsDef: MenuItemDef[] = $state([]);

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
    let name = commandNameOverride(kCmdToggleSpellChecking);
    commandsDef.push([name, kCmdToggleSpellChecking]);
  }

  function closeTab(noteName: string) {
    if (noteName != settings.currentNoteName) {
      settingsRemoveTab(settings, noteName);
      return;
    }
    let idx = settings.tabs.indexOf(noteName);
    settingsRemoveTab(settings, noteName);
    if (idx >= len(settings.tabs)) {
      idx = len(settings.tabs) - 1;
    }
    let toOpen = settings.tabs[idx];
    openNote(toOpen, false);
  }

  function closeCurrentTab() {
    if (len(settings.tabs) < 2) {
      return;
    }
    closeTab(settings.currentNoteName);
  }

  function openAskAI() {
    let view = getEditorView();
    let b = getActiveNoteBlock(view.state)!;
    let from = b.contentFrom,
      to = b.to;
    let { selectedText } = getCurrentSelection(view.state);
    askAIStartText = selectedText ? selectedText : view.state.sliceDoc(from, to);
    showingAskAI = true;
  }

  function openCommandPalette() {
    buildCommandPaletteDef();
    showingCommandPalette = true;
  }

  async function executeCommand(cmdId: number) {
    // console.log("executeCommand:", cmdId);
    showingCommandPalette = false;
    onmenucmd(cmdId);
  }

  function getEditorComp(): Editor {
    return editorRef;
  }

  function getEditor(): MultiBlockEditor {
    return editorRef.getEditor();
  }

  function getEditorView(): EditorView {
    if (!editorRef) {
      // TODO: change result type to EditorView | undefined but it'll
      // require fixing a lot of callers
      // @ts-ignore
      return;
    }
    let view = editorRef.getEditorView();
    return view;
  }

  function formatCurrentBlock() {
    formatBlockContent(getEditor());
    logNoteOp("noteFormatBlock");
  }

  function toggleCurrentNoteStar() {
    toggleNoteStarred(noteName);
    getEditor().focus();
  }

  function insertAskAIResponse(s: string) {
    let view = getEditorView();
    if (isReadOnly(view)) {
      return false;
    }
    let text = blockHdrMarkdown + s;
    insertAfterActiveBlock(view, text);
  }

  export async function runBlockContent(editor: MultiBlockEditor): Promise<boolean> {
    const view = editor.view;
    const { state } = view;
    if (isReadOnly(view)) {
      return false;
    }
    const block = getActiveNoteBlock(state)!;
    const lang = getLanguage(block.language)!;
    // console.log("runBlockContent: lang:", lang);
    if (!langSupportsRun(lang)) {
      return false;
    }

    const content = state.sliceDoc(block.contentFrom, block.to);

    showModalMessageHTML("running code", 300);
    editor.setReadOnly(true);
    let output = "";
    let token = lang.token;
    let res: CapturingEval | undefined;
    if (token === "golang") {
      res = await runGo(content);
    } else if (token === "javascript") {
      res = await runJS(content);
    } else {
      output = `Error: invalid block lang ${lang.token}`;
    }
    editor.setReadOnly(false);
    clearModalMessage();
    if (!res) return false;

    output = evalResultToString(res);
    if (!output) {
      output = "executed code returned empty output";
    }

    console.log("output of running code:", output);
    // const block = getActiveNoteBlock(state)
    let text = output;
    if (!output.startsWith("\n∞∞∞")) {
      // text = "\n∞∞∞text-a\n" + "output of running the code:\n" + output;
      text = "\n∞∞∞text-a\n" + output;
    }
    insertAfterActiveBlock(view, text);
    return true;
  }

  export async function runBlockContentWithArg(editor: MultiBlockEditor, arg: string): Promise<boolean> {
    const view = editor.view;
    const { state } = view;
    if (isReadOnly(view)) {
      return false;
    }
    const block = getActiveNoteBlock(state)!;
    const lang = getLanguage(block.language)!;
    // console.log("runBlockContent: lang:", lang);
    if (!langSupportsRun(lang)) {
      return false;
    }

    let from = block.contentFrom,
      to = block.to;
    const content = state.sliceDoc(from, to);

    showModalMessageHTML("running code", 300);
    editor.setReadOnly(true);

    let res: CapturingEval | undefined;
    let token = lang.token;

    if (token === "javascript") {
      res = await runJSWithArg(content, arg);
    } else {
      res = {
        output: "",
        consoleLogs: [],
        exception: `Error: unspported language '${token}'`,
      };
    }
    editor.setReadOnly(false);
    clearModalMessage();

    let output = evalResultToString(res);
    if (!output) {
      output = "executed code returned empty output";
    }

    console.log("output of running code:", res);
    // const block = getActiveNoteBlock(state)
    let text = output;
    if (!output.startsWith("\n∞∞∞")) {
      // text = "\n∞∞∞text-a\n" + "output of running the code:\n" + output;
      text = "\n∞∞∞text-a\n" + output;
    }
    insertAfterActiveBlock(view, text);
    return true;
  }

  function runCurrentBlock() {
    let editor = getEditor();
    runBlockContent(editor);
    editor.focus();
    logNoteOp("runBlock");
  }

  let fnSelectBlock: (block: NoteBlock) => void = $state(selectBlock);

  function runBlockWithAnotherBlock(block: NoteBlock) {
    console.log(block);
    closeDialogs();
    let n = block.index;
    let editor = getEditor();
    let state = editor.view.state;
    let blockArg = getBlockN(state, n);
    let arg = state.sliceDoc(blockArg.contentFrom, blockArg.to);
    runBlockContentWithArg(editor, arg);
    editor.focus();
    logNoteOp("runBlockWithBlock");
  }

  function currentBlockSupportsRun(state: EditorState): boolean {
    const block = getActiveNoteBlock(state)!;
    const lang = getLanguage(block.language);
    // console.log("runBlockContent: lang:", lang);
    return langSupportsRun(lang);
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
    let arg = await getClipboardText();
    runBlockContentWithArg(editor, arg);
    editor.focus();
    logNoteOp("runBlockWithClipboard");
  }

  // if have a selection, run function with selection
  // if runnable block, run the block
  // otherwise run a function with current block
  function smartRun() {
    let view = getEditorView();
    if (isReadOnly(view)) {
      return;
    }

    let hasSel = hasSelection();
    let supportsRun = currentBlockSupportsRun(view.state);
    // console.log(`smartRun: hasSelection=${hasSel} supportsRun=${supportsRun}`);
    if (hasSel) {
      openFunctionSelector(true);
    } else if (supportsRun) {
      runCurrentBlock();
    } else {
      openFunctionSelector(false);
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
    let noteName = settings.currentNoteName;
    closeDialogs();
    let editor = getEditor();
    let s = editor.getContent() || "";
    await renameNote(noteName, newName, s);
    await openNote(newName, true);
    // console.log("onRename: newName:", newName);
  }

  function openQuickAccess() {
    appState.showingQuickAccess = true;
  }

  async function onOpenNote(name: string, newTab = false) {
    // must get before closeDialg()
    let forceNewTab = appState.forceNewTab;

    closeDialogs();
    if (name == settings.currentNoteName) {
      return;
    }
    if (forceNewTab) {
      newTab = true;
    }

    function maybeReplaceCurrentTab() {
      if (newTab || settings.tabs.includes(name)) {
        return;
      }
      // replace current tab with new note
      let idx = settings.tabs.indexOf(settings.currentNoteName);
      if (idx >= 0) {
        // openNote() will change settings.currentNoteName to
        settings.tabs[idx] = name;
      }
    }
    maybeReplaceCurrentTab();
    await openNote(name);
  }

  async function openNote(name: string, skipSave = false, noPushHistory = false) {
    console.log("App.openNote:", name);
    let msg = `Loading <span class="font-bold">${name}</span>...`;
    showModalMessageHTML(msg, 300);
    let editor = getEditorComp();
    await editor.openNote(name, skipSave, noPushHistory);
    // await sleep(400);
    clearModalMessage();
    getEditorComp().focus();
  }

  function openNoteFromFind(name: string, pos: number) {
    closeDialogs();
    openNote(name).then(() => {
      // TODO: this is not reliable, must pass pos down via openNote()
      setTimeout(() => {
        let view = getEditorView();
        view.dispatch({
          selection: {
            anchor: pos,
            head: pos,
          },
          scrollIntoView: true,
        });
      }, 200);
    });
  }

  function moveCurrentBlock() {
    showingBlockMoveSelector = true;
  }

  async function onMoveBlockToNote(name: string) {
    showingBlockMoveSelector = false;
    // name can be new or existing note
    let state = getEditorView().state;
    let block = getActiveNoteBlock(state)!;
    let delim = state.sliceDoc(block.from, block.contentFrom);
    let content = state.sliceDoc(block.contentFrom, block.to);
    await appendToNote(name, delim + content);
    let view = getEditorView();
    let ednaEditor = getEditor();
    deleteBlock(ednaEditor)(view);
    view.focus();
  }

  async function onCreateNote(name: string) {
    closeDialogs();
    await createNoteWithName(name);
    openNote(name);
    // TODO: add a way to undo creation of the note
    showToast(`Created note '${name}'`);
    logNoteOp("noteCreate");
  }

  async function deleteNotePermanently(name: string, showNotif: boolean) {
    if (!canDeleteNote(name)) {
      showWarning(`Can't delete special note ${name}`);
      console.log("cannot delete note:", name);
      return;
    }

    let settings = getSettings();
    let noteTabIdx = settings.tabs.indexOf(name);
    if (noteTabIdx >= 0) {
      settings.tabs.splice(noteTabIdx);
    }
    // if deleting current note, first switch to scratch note
    // TODO: maybe switch to the most recently opened
    if (name === settings.currentNoteName || len(settings.tabs) == 0) {
      await openNote(kScratchNoteName);
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
    let { state, dispatch } = editor.view;
    dispatch(
      state.update(
        {
          changes: {
            from: 0,
            insert: s + "\n",
          },
          selection: EditorSelection.cursor(len(s) + 1),
          annotations: [heynoteEvent.of(ADD_NEW_BLOCK)],
        },
        {
          scrollIntoView: true,
          userEvent: "input",
        },
      ),
    );
  }

  function didLoadNote(name: string, noPushHistory = false) {
    console.log("didLoadNote:", name);
    throwIf(!name);
    console.log("onDocChanged: just opened");
    let editor = editorRef.getEditor();
    let readOnly = isSystemNoteName(name);
    editor.setReadOnly(readOnly);
    window.document.title = name;
    if (!noPushHistory) {
      addNoteToBrowserHistory(name);
      addNoteToHistory(name);
    }
    settings.currentNoteName = name;
    if (name == kDailyJournalNoteName) {
      // doesn't work without delay
      setTimeout(() => autoCreateDayInJournal(editor), 100);
      // console.log("journal, so going to next block");
      // editor.gotoNextBlock();
    }
    settingsAddTab(settings, name);
    updateDocSize();
  }

  function docDidChange() {
    updateDocSize();
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
      {menuItemStatus}
      {onmenucmd}
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
  <Editor
    class="row-start-2 col-start-2"
    cursorChange={onCursorChange}
    {extraKeymap}
    {didLoadNote}
    {docDidChange}
    bind:this={editorRef}
  />
</div>

{#if !settings.alwaysShowTopNav}
  <TopNav openNote={onOpenNote} {closeTab} {openNoteSelector} {menuItemStatus} {onmenucmd} {buildMenuDef} />
{/if}
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

{#if showingFunctionSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <FunctionSelector context={functionContext} {userFunctions} {runFunction}></FunctionSelector>
  </Overlay>
{/if}

{#if showingBlockMoveSelector}
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

{#if showingNoteSelector}
  {#if settings.useWideSelectors}
    <Overlay onclose={closeDialogs} blur={true}>
      <NoteSelectorWide
        {switchToRegularNoteSelector}
        {switchToCommandPalette}
        openNote={onOpenNote}
        deleteNote={deleteNotePermanently}
        createNote={onCreateNote}
      />
    </Overlay>
  {:else}
    <Overlay onclose={closeDialogs} blur={true}>
      <NoteSelector
        {switchToWideNoteSelector}
        {switchToCommandPalette}
        openNote={onOpenNote}
        createNote={onCreateNote}
        deleteNote={deleteNotePermanently}
      />
    </Overlay>
  {/if}
{/if}

{#if showingLanguageSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <LanguageSelector selectLanguage={onSelectLanguage} />
  </Overlay>
{/if}

{#if modalMessageState.isShowing}
  <ModalMessage />
{/if}

{#if showingRenameNote}
  <Overlay onclose={closeDialogs} blur={true}>
    <RenameNote onclose={closeDialogs} rename={onRename} oldName={noteName} />
  </Overlay>
{/if}

{#if showingSettings}
  <Overlay onclose={closeDialogs} blur={true}>
    <Settings></Settings>
  </Overlay>
{/if}
<Toaster></Toaster>

{#if showingCommandPalette}
  <Overlay onclose={closeDialogs} blur={true}>
    <CommandPalette {commandsDef} {executeCommand} {switchToNoteSelector} />
  </Overlay>
{/if}

{#if showingContextMenu}
  <Overlay onclose={closeDialogs}>
    <Menu {menuItemStatus} {onmenucmd} menuDef={contextMenuDef} pos={contextMenuPos} />
  </Overlay>
{/if}

{#if showingFindInNotes}
  <Overlay blur={true} onclose={closeDialogs}>
    <FindInNotes openNote={openNoteFromFind}></FindInNotes>
  </Overlay>
{/if}

{#if showingEncryptPassword}
  <Overlay onclose={closeEncryptPassword} blur={true}>
    <EnterEncryptPassword onclose={closeEncryptPassword} onpassword={onEncryptPassword}></EnterEncryptPassword>
  </Overlay>
{/if}

{#if showingDecryptPassword}
  <Overlay onclose={closeDecryptPassword} blur={true}>
    <EnterDecryptPassword msg={showingDecryptMessage} onpassword={onDecryptPassword}></EnterDecryptPassword>
  </Overlay>
{/if}

{#if showingAskFileWritePermissions}
  <Overlay noCloseOnEsc={true} blur={true}>
    <AskFileWritePermissions fileHandle={fileWritePermissionsFileHandle!} close={askFileWritePermissionsClose}
    ></AskFileWritePermissions>
  </Overlay>
{/if}

{#if showingAskAI}
  <Overlay blur={true} onclose={closeDialogs}>
    <AskAI close={closeDialogs} startText={askAIStartText} insertResponse={insertAskAIResponse}></AskAI>
  </Overlay>
{/if}
