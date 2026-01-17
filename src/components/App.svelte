<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    toggleBlockComment,
    toggleComment,
    toggleLineComment,
  } from "@codemirror/commands";
  import { foldCode, unfoldCode } from "@codemirror/language";
  import {
    closeSearchPanel,
    openSearchPanel,
    searchPanelOpen,
  } from "@codemirror/search";
  import { EditorSelection, EditorState } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import {
    appState,
    findNoteByName,
    updateAppStateAfterNotesChange,
  } from "../appstate.svelte";
  import { ADD_NEW_BLOCK, heynoteEvent } from "../editor/annotation";
  import {
    getActiveNoteBlock,
    getBlockN,
    getBlocksInfo,
  } from "../editor/block/block";
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
  import {
    formatBlockContent,
    insertAfterActiveBlock,
  } from "../editor/block/format-code";
  import { transposeChars } from "../editor/block/transpose-chars";
  import { getCurrentSelection, isReadOnly } from "../editor/cmutils";
  import { insertDateAndTime } from "../editor/date-time";
  import { EdnaEditor, setReadOnly } from "../editor/editor";
  import {
    foldAllBlocks,
    foldBlock,
    toggleBlockFold,
    unfoldAlBlocks,
    unfoldBlock,
    unfoldEverything,
  } from "../editor/fold-gutter";
  import {
    extForLang,
    getLanguage,
    langSupportsFormat,
    langSupportsRun,
  } from "../editor/languages";
  import { isUsingEncryption } from "../encrypt";
  import { fromFileName, isValidFileName, toFileName } from "../filenamify";
  import { fsFileHandleWriteBlob, supportsFileSystem } from "../fileutil";
  import {
    parseUserFunctions,
    runBoopFunction,
    type BoopFunction,
  } from "../functions";
  import { setGlobalFuncs } from "../globals";
  import { addNoteToHistory } from "../history";
  import { importEdnaNotesFromZipFile } from "../import-edna-notes";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import Menu, {
    kMenuIdJustText,
    kMenuSeparator,
    kMenuStatusDisabled,
    kMenuStatusNormal,
    kMenuStatusRemoved,
  } from "../Menu.svelte";
  import { downloadBrowserStoreAsZip } from "../migrate-local-to-backend";
  import { isMoving } from "../mouse-track.svelte";
  import { Note } from "../note";
  import {
    appendToNote,
    archiveNote,
    blockHdrMarkdown,
    blockHdrPlainText,
    canDeleteNote,
    createIfNotExists,
    createNoteWithName,
    createUniqueScratchNote,
    decryptAllNotes,
    deleteNote,
    encryptAllNotes,
    isNoteArchivable,
    isNoteArchived,
    isSystemNoteName,
    isValidNoteName,
    kBuiltInFunctionsNoteName,
    kDailyJournalNoteName,
    kHelpSystemNoteName,
    kMyFunctionsNoteName,
    kReleaseNotesSystemNoteName,
    kScratchNoteName,
    kWelcomeDevSystemNoteName,
    kWelcomeSystemNoteName,
    loadNoteContentIfExists,
    renameNote,
    toggleNoteStarred,
    unArchiveNote,
  } from "../notes";
  import { exportNotesToZip } from "../notes-export";
  import { evalResultToString, runGo, runJS, runJSWithArg } from "../run";
  import { getSettings } from "../settings.svelte";
  import { startServerSideEvents } from "../sse";
  import { getMyFunctionsNote } from "../system-notes";
  import { parseTab, Tab } from "../tab";
  import {
    addTabToBrowserHistory,
    browserDownloadBlob,
    formatDateYYYYMMDDDay,
    getClipboardText,
    isAltNumEvent,
    isDev,
    len,
    platform,
    stringSizeInUtf8Bytes,
    throwIf,
    trimPrefix,
    trimSuffix,
  } from "../util";
  import AskAI from "./AskAI.svelte";
  import BlockSelector from "./BlockSelector.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import CreateNewNote from "./CreateNewNote.svelte";
  import Editor from "./Editor.svelte";
  import EnterDecryptPassword from "./EnterDecryptPassword.svelte";
  import EnterEncryptPassword from "./EnterEncryptPassword.svelte";
  import FindInNotes from "./FindInNotes.svelte";
  import FunctionSelector from "./FunctionSelector.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import Login from "./Login.svelte";
  import ModalInfo, { modalInfoState } from "./ModalInfo.svelte";
  import ModalMessage, {
    hideModalMessage,
    modalMessageState,
    showModalMessageHTML,
  } from "./ModalMessage.svelte";
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

  type MenuItemDef = import("../Menu.svelte").MenuItemDef;

  const isMac = platform.isMac;

  let settings = getSettings();

  let column = $state(1);
  let docSize = $state(0);
  let language = $state("text");
  let languageAuto = $state(true);
  let line = $state(1);
  let currTabStr = $derived(settings.currentTab);

  let currTab: Tab = $derived(parseTab(currTabStr));

  let selectionSize = $state(0);

  let showingContextMenu = $state(false);
  let showingLanguageSelector = $state(false);
  let showingNoteSelector = $state(false);
  let showingBlockMoveSelector = $state(false);
  let showingCommandPalette = $state(false);
  let showingCreateNewNote = $state(false);
  let showingFunctionSelector = $state(false);
  let showingSettings = $state(false);
  let showingRenameNote = $state(false);
  let showingQuickAccess = $state(false);
  let showingBlockSelector = $state(false);
  let showingFindInNotes = $state(false);
  let showingEncryptPassword = $state(false);
  let showingDecryptPassword = $state(false);
  let showingDecryptMessage = $state("");
  let showingAskAI = $state(false);

  let isShowingDialog = $derived.by(() => {
    return (
      showingContextMenu ||
      showingLanguageSelector ||
      showingNoteSelector ||
      showingBlockMoveSelector ||
      showingCommandPalette ||
      showingCreateNewNote ||
      showingFunctionSelector ||
      showingSettings ||
      showingRenameNote ||
      showingQuickAccess ||
      showingBlockSelector ||
      showingFindInNotes ||
      appState.showingLogin ||
      showingDecryptPassword ||
      showingEncryptPassword
    );
  });

  function closeDialogs() {
    showingContextMenu = false;
    showingLanguageSelector = false;
    showingNoteSelector = false;
    showingBlockMoveSelector = false;
    showingCommandPalette = false;
    showingCreateNewNote = false;
    showingFunctionSelector = false;
    showingSettings = false;
    showingRenameNote = false;
    showingQuickAccess = false;
    showingBlockSelector = false;
    showingFindInNotes = false;
    showingAskAI = false;
    appState.showingLogin = false;
    showingDecryptPassword = false;
    showingEncryptPassword = false;

    appState.forceNewTab = false;

    getEditorComp().focus();
  }

  let isSpellChecking = $state(false);

  let functionContext = $state("");
  let runFunctionOnSelection = false;
  let userFunctions = $state([]); // note: $state() not needed
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

  function updateAfterNoteStateChangeDispatch(allNotes: Note[]): void {
    tick().then(() => {
      updateAppStateAfterNotesChange(allNotes);
      // re-assign tabs to redraw the state of the note in title
      settings.tabs = [...settings.tabs];
    });
  }

  let gf = {
    openSettings: openSettings,
    openLanguageSelector: openLanguageSelector,
    openCreateNewNote: openCreateNewNote,
    openNoteSelector: openNoteSelector,
    openCommandPalette: openCommandPalette,
    openContextMenu: openContextMenu,
    openFindInNotes: openFindInNotes,
    openQuickAccess: openQuickAccess,
    createScratchNote: createScratchNote,
    openBlockSelector: openBlockSelector,
    openFunctionSelector: openFunctionSelector,
    updateAfterNoteStateChange: updateAfterNoteStateChangeDispatch,
    smartRun: smartRun,
    focusEditor: focusEditor,
    getPassword: getPassword,
    closeTabWithName: closeTabWithName,
    reloadIfCurrent: reloadIfCurrent,
  };
  setGlobalFuncs(gf);

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
        ev.returnValue = true;
      } else {
        logAppExit();
      }
    });

    window.addEventListener("popstate", function (ev) {
      let state = ev.state;
      if (!state || !state.tabStr) {
        console.log("popstate: state is null or has no 'tabStr' field:", state);
        return;
      }
      let tabStr = state.tabStr;
      console.log("popstate:", tabStr, state);
      if (currTabStr === tabStr) {
        console.log("same as currTabStr, nothing to do");
        return;
      }
      let noPushHistory = true;
      let tab = parseTab(tabStr);
      if (tab.isURL()) {
        openURLInTab(tab.value, noPushHistory);
        return;
      }
      let noteName = tab.value;
      if (!isValidNoteName(noteName)) {
        console.error(`note '${noteName}' doesn't exist`);
        return;
      }
      openNote(noteName, false /* skip save */, noPushHistory);
    });

    logAppOpen();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  function onKeyDown(ev: KeyboardEvent): void {
    // we bind Mod-h in CocdeMirror which only works if CodeMirror has
    // focus. We have to prevent it here to disable the default
    // behavior of hiding a window
    if (ev.key == "h") {
      if (ev.ctrlKey || ev.metaKey) {
        if (isShowingDialog) {
          ev.preventDefault();
          if (showingQuickAccess) {
            showingQuickAccess = false;
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
        // @ts-ignore
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
        let notes = appState.regularNotes;
        for (let note of notes) {
          if (note.altShortcut == altN && !isShowingNote(note.name)) {
            // console.log("onKeyDown: opening note: ", o.name, " altN:", altN, " e:", e)
            openNote(note.name);
            showingQuickAccess = false;
            ev.preventDefault();
            return;
          }
        }
      }
    }

    // hack: stop Ctrl + O unless it originates from code mirror (because then it
    // triggers NoteSelector)
    if (ev.key == "o" && ev.ctrlKey && !ev.altKey && !ev.shiftKey) {
      let target = /** @type {HTMLElement} */ (ev.target);
      let fromCodeMirror = target && target.className.includes("cm-content");
      if (!fromCodeMirror) {
        ev.preventDefault();
      }
    }
  }

  function isShowingNote(name: string): boolean {
    return currTab.isNote() && name === currTab.value;
  }

  let closeDecryptPassword = $state(null);
  let onDecryptPassword = $state(null);

  async function getPassword(msg: string = ""): Promise<string> {
    showingDecryptPassword = true;
    showingDecryptMessage = msg;
    hideModalMessage();
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

  function openEncryptPassword() {
    showingEncryptPassword = true;
  }

  function onEncryptPassword(pwd: string) {
    console.log("got encryption password:", pwd);
    closeDialogs();
    encryptAllNotes(pwd);
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
    let block = getActiveNoteBlock(editor.view.state);
    let ext = extForLang(block.language.name);
    let name = toFileName(settings.currentTab) + `-${bi.active}.` + ext;
    let { from, to } = block.content;
    let s = editor.view.state.sliceDoc(from, to);
    console.log("exportCurrentBlock:", name);
    const blob = new Blob([s], { type: "text/plain" });
    await exportBlobToFile(blob, name);
  }

  async function exportCurrentNote() {
    let settings = getSettings();
    let fileName = toFileName(settings.currentTab) + ".elaris.txt";
    let editor = getEditor();
    let s = editor.getContent();
    console.log("exportCurrentNote:", fileName);
    const blob = new Blob([s], { type: "text/plain" });
    await exportBlobToFile(blob, fileName);
  }

  function openSettings() {
    showingSettings = true;
  }
  createUniqueScratchNote;
  async function createScratchNote() {
    let name = await createUniqueScratchNote();
    await onOpenNote(name);
    // TODO: add a way to undo creation of the note
    showToast(`Created scratch note '${name}'`);
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

  /** @type {import("./BlockSelector.svelte").Item[]} */
  let blockItems = $state([]);
  let blockView = $state(null);
  let initialBlockSelection = $state(0);

  function openBlockSelector(fn = selectBlock) {
    console.log("openBlockSelector");
    fnSelectBlock = fn;
    let editor = getEditor();
    let blocks = editor.getBlocks();
    let activeBlock = getActiveNoteBlock(editor.view.state);
    let content = editor.getContent();
    /** @type {import("./BlockSelector.svelte").Item[]} */
    let items = [];
    let blockNo = 0;
    let currBlockNo = 0;
    for (let b of blocks) {
      let title = extractBlockTitle(content, b.content.from, b.content.to);
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
    blockView = getEditorView();
    initialBlockSelection = currBlockNo;
    showingBlockSelector = true;
  }

  function openCreateNewNote() {
    showingCreateNewNote = true;
  }

  function selectBlock(blockItem) {
    // console.log("selectBlock", $state.snapshot(blockItem));
    let n = blockItem.key;
    let view = getEditorView();
    gotoBlock(view, n);
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
    let userFunctionsStr = await loadNoteContentIfExists(kMyFunctionsNoteName);
    if (!userFunctionsStr) {
      userFunctions = [];
    } else {
      userFunctions = parseUserFunctions(userFunctionsStr);
    }
    showingFunctionSelector = true;
  }

  type BoopFunctionArg = import("../functions").BoopFunctionArg;

  export async function runBoopFunctionWithText(
    f: BoopFunction,
    txt: string,
  ): Promise<BoopFunctionArg> {
    let input = {
      text: txt,
      fullText: txt,
      postInfo: (s) => {
        console.log("postInfo:", s);
        showToast(s, 0);
      },
      postError: (s) => {
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
        return;
      }
      let text = res;
      if (!res.startsWith("\n∞∞∞")) {
        text = blockHdrPlainText + res;
      }
      insertAfterActiveBlock(view, text);
    }
  }

  async function runBoopFunctionWithBlockContent(
    view: EditorView,
    fdef: BoopFunction,
    replace: boolean,
  ): Promise<boolean> {
    const { state } = view;
    if (state.readOnly) return false;
    const block = getActiveNoteBlock(state);
    console.log("editorRunBlockFunction:", block);
    const cursorPos = state.selection.asSingle().ranges[0].head;
    const content = state.sliceDoc(block.content.from, block.content.to);
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
      let cursorOffset = cursorPos - block.content.from;
      const tr = view.state.update(
        {
          changes: {
            from: block.content.from,
            to: block.content.to,
            insert: res,
          },
          selection: EditorSelection.cursor(
            block.content.from + Math.min(cursorOffset, res.length),
          ),
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
        text = blockHdrPlainText + res;
      }
      insertAfterActiveBlock(view, text);
    }
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
    hideModalMessage();
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
  const kCmdImportEdnaNotes = nmid();
  const kCmdExportCurrentNote = nmid();
  const kCmdDownloadBrowserstore = nmid();
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

  function buildMenuDef() {
    if (!currTab.isNote()) {
      return [];
    }
    let currNoteName = currTab.value;
    let starAction = "Add to favorites";
    let note = findNoteByName(currNoteName);
    if (note && note.isStarred) {
      //starAction = "Un-star";
      starAction = "Remove from favorites";
    }

    const menuNote = [
      ["Close tab", kCmdCloseCurrentTab],
      ["Rename", kCmdRenameCurrentNote],
      [starAction, kCmdNoteToggleStarred],
      ["Archive", kCmdArchiveCurrentNote],
      ["Un-archive", kCmdUnArchiveCurrentNote],
      ["Delete permanently", kCmdPermanentlyDeleteNote],
      ["Export to file", kCmdExportCurrentNote],
    ];

    const menuBlock = [
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
        ? [
            ["Toggle block fold\tMod + Alt + .", kCmdToggleBlockFold],
            ["Fold block\tMod + Alt + [", kCmdFoldBlock],
            ["Unfold block\tMod + Alt + ]", kCmdUnfoldBlock],
          ]
        : [
            ["Toggle block fold\tCtrl + Alt + .", kCmdToggleBlockFold],
            ["Fold block\tCtrl + Alt + [", kCmdFoldBlock],
            ["Unfold block\tCtrl + Alt + ]", kCmdUnfoldBlock],
          ]),
    ];

    const menuRun = [
      ["Smart Run\tMod + E", kCmdSmartRun],
      ["Run this block", kCmdRunBlock],
      ["Run this block with another block", kCmdRunBlockWithAnotherBlock],
      ["Run this block with clipboard", kCmdRunBlockWithClipboard],
      [
        "Run function with this block\tAlt + Shift + R",
        kCmdRunFunctionWithBlockContent,
      ],
      ["Run function with selection", kCmdRunFunctionWithSelection],
      ["Show built-in functions", kCmdShowBuiltInFunctions],
      ["Create your own functions", kCmdCreateYourOwnFunctions],
      ["Help", kCmdRunHelp],
    ];

    const menuStorage = [
      ["Export all notes to .zip file", kCmdExportNotes],
      kMenuSeparator,
      ["Help: storage", kCmdShowStorageHelp],
    ];

    const menuEncrypt = [
      ["Encrypt all notes", kCmdEncryptNotes],
      ["Decrypt all notes", kCmdDecryptNotes],
      ["Help: encryption", kCmdEncryptionHelp],
    ];

    const menuHelp = [
      ["Show help", kCmdShowHelp],
      ["Show help as note", kCmdShowHelpAsNote],
      ["Release notes", kCmdShowReleaseNotes],
      ["Show Welcome Note", kCmdShowWelcomeNote],
    ];

    if (isDev()) {
      menuHelp.push(["Show Welcome Dev Note", kCmdShowWelcomeDevNote]);
    }

    const contextMenu = [
      ["Command Palette\tMod + Shift + K", kCmdCommandPalette],
      ["Open note\tMod + K", kCmdOpenNote],
      ["New note", kCmdCreateNewNote],
      ["Ask AI", kCmdAskAI],
      // ["Find\tMod + Q", kCmdOpenFind],
      ["This note", menuNote],
      ["Block", menuBlock],
      ["Run code", menuRun],
      ["Notes storage", menuStorage],
      ["Encryption", menuEncrypt],
    ];
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
    kCmdCreateNewNote,
    "Create New Note",
  ];

  const commandPaletteAdditions: MenuItemDef[] = [
    ["Import Edna notes", kCmdImportEdnaNotes],
    ["Create New Scratch Note", kCmdCreateScratchNote],
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
    ["Edit: Insert date and time\tAlt-Shift-d", kCmdInsertDateAndTime],
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
    let noteName = settings.currentTab;
    // console.log("menuItemStatus:", mi);
    // console.log("s:", s, "mid:", mid);
    // note: this is called for each menu item so should be fast
    let lang = getLanguage(language);
    // console.log("dh:", dh);
    let hasFS = false;
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
      // permissions dialog https://github.com/kjk/elaris/issues/81
      // if (!mostRecentHasClipboardText) {
      //   return kMenuStatusDisabled;
      // }
    } else if (mid === kCmdMoveNotesToDirectory) {
      // currently using directory
      return kMenuStatusRemoved;
    } else if (mid == kCmdSwitchToLocalStorage) {
      return kMenuStatusRemoved;
    } else if (mid === kCmdEncryptNotes) {
      return isUsingEncryption() ? kMenuStatusDisabled : kMenuStatusNormal;
    } else if (mid === kCmdDecryptNotes) {
      return isUsingEncryption() ? kMenuStatusNormal : kMenuStatusDisabled;
      return kMenuStatusRemoved;
    } else if (mid === kCmdRenameCurrentNote) {
      if (noteName === kScratchNoteName) {
        return kMenuStatusDisabled;
      }
      if (isSystemNoteName(noteName)) {
        return kMenuStatusDisabled;
      }
    } else if (
      mid === kCmdRunFunctionWithBlockContent ||
      mid === kCmdRunFunctionWithSelection
    ) {
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
    // @ts-ignore
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
      deleteNotePermanently(settings.currentTab, true);
      view.focus();
    } else if (cmdId === kCmdArchiveCurrentNote) {
      archiveNote(settings.currentTab);
      view.focus();
    } else if (cmdId === kCmdUnArchiveCurrentNote) {
      unArchiveNote(settings.currentTab);
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
      // @ts-ignore
      foldCode(view);
      view.focus();
    } else if (cmdId === kCmdUnfoldColde) {
      // @ts-ignore
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
      // openNoteFromDisk();
    } else if (cmdId === kCmdAskAI) {
      openAskAI();
    } else if (cmdId === kCmdToggleSpellChecking) {
      toggleSpellCheck();
      view.focus();
    } else if (cmdId === kCmdToggleSpellChecking2) {
      toggleSpellCheck();
      view.focus();
    } else if (cmdId === kCmdShowHelp) {
      showHTMLHelpInTab();
      view.focus();
    } else if (cmdId === kCmdShowHelpAsNote) {
      openNote(kHelpSystemNoteName);
    } else if (cmdId === kCmdShowReleaseNotes) {
      openNote(kReleaseNotesSystemNoteName);
    } else if (cmdId === kCmdShowWelcomeNote) {
      openNote(kWelcomeSystemNoteName);
    } else if (cmdId === kCmdRunHelp) {
      showHTMLHelpInTab("#running-code");
    } else if (cmdId == kCmdShowWelcomeDevNote) {
      openNote(kWelcomeDevSystemNoteName);
    } else if (cmdId === kCmdMoveNotesToDirectory) {
      // storeNotesOnDisk();
    } else if (cmdId === kCmdSwitchToNotesInDir) {
      // await pickAnotherDirectory2();
    } else if (cmdId === kCmdSwitchToLocalStorage) {
      // await switchToBrowserStorage();
    } else if (cmdId === kCmdExportNotes) {
      exportNotesToZip();
    } else if (cmdId === kCmdImportEdnaNotes) {
      importEdnaNotesFromZipFile();
    } else if (cmdId === kCmdExportCurrentNote) {
      exportCurrentNote();
    } else if (cmdId === kCmdNoteToggleStarred) {
      toggleCurrentNoteStar();
    } else if (cmdId === kCmdShowStorageHelp) {
      showHTMLHelpInTab("#storing-notes-on-disk");
    } else if (cmdId === kCmdSettings) {
      openSettings();
    } else if (cmdId === kCmdEncryptNotes) {
      openEncryptPassword();
    } else if (cmdId === kCmdDecryptNotes) {
      decryptAllNotes();
    } else if (cmdId === kCmdEncryptionHelp) {
      showHTMLHelpInTab("#encryption");
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
    } else if (cmdId === kCmdDownloadBrowserstore) {
      downloadBrowserStoreAsZip();
    } else if (cmdId === kCmdFind || cmdId == kCmdSearch) {
      openFindPanel();
    } else if (cmdId === kCmdFindInNotes || cmdId == kCmdSearchInNotes) {
      openFindInNotes();
    } else {
      console.log("unknown menu cmd id");
    }
  }

  async function openCustomFunctionsNote() {
    let content = getMyFunctionsNote();
    await createIfNotExists(kMyFunctionsNoteName, content, null);
    await openNote(kMyFunctionsNoteName);
  }

  let contextMenuDef = $state(null);
  /**
   * @param {MouseEvent} ev
   */
  async function oncontextmenu(ev) {
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

  /**
   * @param {MouseEvent} ev
   * @param {{x: number, y: number}} pos
   */
  async function openContextMenu(ev, pos = null) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    contextMenuDef = buildMenuDef();
    contextMenuPos = pos || { x: ev.x, y: ev.y };
    showingContextMenu = true;
  }

  function commandNameOverride(id: number, name: string) {
    if (!currTab.isNote()) {
      return name;
    }
    let currNoteName = currTab.value;
    if (id === kCmdToggleSpellChecking) {
      return (isSpellChecking ? "Disable" : "Enable") + " spell checking";
    }
    let n = len(commandNameOverrides);
    for (let i = 0; i < n; i += 2) {
      if (id == commandNameOverrides[i]) {
        return commandNameOverrides[i + 1];
      }
    }
    if (id >= kCmdBlockFirst && id <= kCmdBlockLast) {
      return "Block: " + name;
    }
    if (id === kCmdNoteToggleStarred) {
      let starAction = "Add current note to favorites";
      let note = findNoteByName(currNoteName);
      if (note && note.isStarred) {
        //starAction = "Un-star";
        starAction = "Remove current note from favorites";
      }
      return starAction;
    }
    return name;
  }

  function buildCommandsDef() {
    let a = [];
    function addMenuItems(items) {
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
        let el = [name, id];
        a.push(el);
      }
    }
    let mdef = buildMenuDef();
    addMenuItems(mdef);
    return a;
  }

  let commandsDef = $state(null);

  function buildCommandPaletteDef() {
    let cmds = buildCommandsDef();
    for (let mi of commandPaletteAdditions) {
      let status = menuItemStatus(mi);
      if (status != kMenuStatusNormal) {
        continue;
      }
      cmds.push(mi);
    }
    // console.log("commandPaletteAdditions:", commandPaletteAdditions);
    let name = commandNameOverride(kCmdToggleSpellChecking);
    cmds.push([name, kCmdToggleSpellChecking]);
    if (isDev()) {
      cmds.push(["Download browser store as zip", kCmdDownloadBrowserstore]);
    }
    commandsDef = cmds;
  }

  function openURLInTab(url: string, noPushHistory = false) {
    let tabStr = "url:" + url;
    settings.addTab(tabStr);
    settings.currentTab = tabStr;
    if (!noPushHistory) {
      addTabToBrowserHistory(tabStr);
    }
  }

  function openTab(tabStr: string) {
    let tab = parseTab(tabStr);
    if (tab.isURL()) {
      settings.currentTab = tabStr;
      addTabToBrowserHistory(tabStr);
      return;
    }
    throwIf(!tab.isNote(), `Invalid tabStr: '${tabStr}'`);
    let noteName = tab.value;
    openNote(noteName, false);
  }

  function closeTab(tabStr: string) {
    if (tabStr != settings.currentTab) {
      settings.removeTab(tabStr);
      return;
    }
    let idx = settings.tabs.indexOf(tabStr);
    settings.removeTab(tabStr);
    if (idx >= len(settings.tabs)) {
      idx = len(settings.tabs) - 1;
    }
    let toOpen = settings.tabs[idx];
    openTab(toOpen);
  }

  function closeCurrentTab() {
    if (len(settings.tabs) < 2) {
      return;
    }
    closeTab(settings.currentTab);
  }

  function openAskAI() {
    let view = getEditorView();
    let b = getActiveNoteBlock(view.state);
    let { from, to } = b.content;
    let { selectedText } = getCurrentSelection(view.state);
    askAIStartText = selectedText
      ? selectedText
      : view.state.sliceDoc(from, to);
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

  function getEditor(): EdnaEditor {
    return editorRef.getEditor();
  }

  function getEditorView(): EditorView {
    if (!editorRef) {
      return null;
    }
    let view = editorRef.getEditorView();
    return view;
  }

  function formatCurrentBlock() {
    let view = getEditorView();
    formatBlockContent(view);
    logNoteOp("noteFormatBlock");
  }

  function toggleCurrentNoteStar() {
    let noteName = currTab.value;
    toggleNoteStarred(noteName);
    getEditor().focus();
  }

  /**
   * @param {string} s
   */
  function insertAskAIResponse(s) {
    let view = getEditorView();
    if (isReadOnly(view)) {
      return false;
    }
    let text = blockHdrMarkdown + s;
    insertAfterActiveBlock(view, text);
  }

  /**
   * @param {EditorView} view
   * @returns {Promise<boolean>}
   */
  export async function runBlockContent(view) {
    const { state } = view;
    if (isReadOnly(view)) {
      return false;
    }
    const block = getActiveNoteBlock(state);
    const lang = getLanguage(block.language.name);
    // console.log("runBlockContent: lang:", lang);
    if (!langSupportsRun(lang)) {
      return false;
    }

    const content = state.sliceDoc(block.content.from, block.content.to);

    showModalMessageHTML("running code", 300);
    setReadOnly(view, true);
    let output = "";
    let token = lang.token;
    /** @type { import("../run").CapturingEval} */
    let res = null;
    if (token === "golang") {
      res = await runGo(content);
    } else if (token === "javascript") {
      res = await runJS(content);
    } else {
      output = `Error: invalid block lang ${lang.token}`;
    }
    setReadOnly(view, false);
    hideModalMessage();

    output = evalResultToString(res);
    if (!output) {
      output = "executed code returned empty output";
    }

    console.log("output of running code:", output);
    // const block = getActiveNoteBlock(state)
    let text = output;
    if (!output.startsWith("\n∞∞∞")) {
      // text = blockHdrPlainText + "output of running the code:\n" + output;
      text = blockHdrPlainText + output;
    }
    insertAfterActiveBlock(view, text);
    return true;
  }

  /**
   * @param {EditorView} view
   * @param {string} arg
   * @returns {Promise<boolean>}
   */
  export async function runBlockContentWithArg(view, arg) {
    const { state } = view;
    if (isReadOnly(view)) {
      return false;
    }
    const block = getActiveNoteBlock(state);
    const lang = getLanguage(block.language.name);
    // console.log("runBlockContent: lang:", lang);
    if (!langSupportsRun(lang)) {
      return false;
    }

    let { from, to } = block.content;
    const content = state.sliceDoc(from, to);

    showModalMessageHTML("running code", 300);
    setReadOnly(view, true);

    /** @type {import("../run").CapturingEval} */
    let res = null;
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
    setReadOnly(view, false);
    hideModalMessage();

    let output = evalResultToString(res);
    if (!output) {
      output = "executed code returned empty output";
    }

    console.log("output of running code:", res);
    // const block = getActiveNoteBlock(state)
    let text = output;
    if (!output.startsWith("\n∞∞∞")) {
      // text = blockHdrPlainText + "output of running the code:\n" + output;
      text = blockHdrPlainText + output;
    }
    insertAfterActiveBlock(view, text);
    return true;
  }

  function runCurrentBlock() {
    let view = getEditorView();
    runBlockContent(view);
    view.focus();
    logNoteOp("runBlock");
  }

  let fnSelectBlock = $state(null);

  function runBlockWithAnotherBlock(argBlockItem) {
    console.log(argBlockItem);
    closeDialogs();
    let n = argBlockItem.key;
    let view = getEditorView();
    let state = view.state;
    let blockArg = getBlockN(state, n);
    let arg = state.sliceDoc(blockArg.content.from, blockArg.content.to);
    runBlockContentWithArg(view, arg);
    view.focus();
    logNoteOp("runBlockWithBlock");
  }

  /**
   * @param {EditorState} state
   * @returns {boolean}
   */
  function currentBlockSupportsRun(state) {
    const block = getActiveNoteBlock(state);
    const lang = getLanguage(block.language.name);
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
    let view = getEditorView();
    if (!currentBlockSupportsRun(view.state)) {
      return;
    }
    let arg = await getClipboardText();
    runBlockContentWithArg(view, arg);
    view.focus();
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

  /**
   * @param {string} anchor
   */
  function showHTMLHelpInTab(anchor = "") {
    // let uri = window.location.origin + "/help"
    let uri = "/help";
    if (anchor != "") {
      uri += anchor;
    }
    openURLInTab(uri);
    // window.open(uri, "_blank");
  }

  /**
   * @param {string} newName
   */
  async function onRename(newName) {
    let noteName = settings.currentTab;
    closeDialogs();
    await renameNote(noteName, newName);
    await openNote(newName, true);
    // console.log("onRename: newName:", newName);
  }

  function openQuickAccess() {
    showingQuickAccess = true;
  }

  /**
   * @param {string} name
   */
  async function onOpenNote(name, newTab = false) {
    // must get before closeDialg()
    let forceNewTab = appState.forceNewTab;

    closeDialogs();
    if (name == settings.currentTab) {
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
      let idx = settings.tabs.indexOf(settings.currentTab);
      if (idx >= 0) {
        // openNote() will change settings.currentNoteName to
        settings.tabs[idx] = name;
      }
    }
    maybeReplaceCurrentTab();
    await openNote(name);
  }

  /**
   * @param {string} name
   * @param {boolean} skipSave
   * @param {boolean} noPushHistory
   */
  async function openNote(name, skipSave = false, noPushHistory = false) {
    console.log("App.openNote:", name);
    let msg = `Loading <span class="font-bold">${name}</span>...`;
    showModalMessageHTML(msg, 300);
    let editor = getEditorComp();
    await editor.openNote(name, skipSave, noPushHistory);
    // await sleep(400);
    hideModalMessage();
    getEditorComp().focus();
  }

  /**
   * @param {string} name
   * @param {number} pos
   */
  function openNoteFromFind(name, pos) {
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

  /**
   * @param {string} name
   */
  async function onMoveBlockToNote(name) {
    showingBlockMoveSelector = false;
    // name can be new or existing note
    let state = getEditorView().state;
    let block = getActiveNoteBlock(state);
    let delim = state.sliceDoc(block.delimiter.from, block.delimiter.to);
    let content = state.sliceDoc(block.content.from, block.content.to);
    await appendToNote(name, delim + content);
    let view = getEditorView();
    let ednaEditor = getEditor();
    deleteBlock(ednaEditor)(view);
    view.focus();
  }

  /**
   * @param {string} name
   */
  async function onCreateNote(name) {
    closeDialogs();
    await createNoteWithName(name);
    openNote(name);
    // TODO: add a way to undo creation of the note
    showToast(`Created note '${name}'`);
    logNoteOp("noteCreate");
  }

  /**
   * @param {string} name
   * @returns {Promise<void>}
   */
  async function closeTabWithName(name) {
    let settings = getSettings();
    let noteTabIdx = settings.tabs.indexOf(name);
    if (noteTabIdx >= 0) {
      settings.tabs.splice(noteTabIdx);
    }
    // if deleting current note, first switch to scratch note
    // TODO: maybe switch to the most recently opened
    if (name === settings.currentTab || len(settings.tabs) == 0) {
      await openNote(kScratchNoteName);
    }
  }

  /**
   * @param {string} name
   * @returns {Promise<void>}
   */
  async function reloadIfCurrent(name) {
    let settings = getSettings();
    let noteTabIdx = settings.tabs.indexOf(name);
    if (noteTabIdx < 0) {
      return;
    }
    if (name === settings.currentTab || len(settings.tabs) > 0) {
      await openNote(name);
    }
  }

  /**
   * @param {string} name
   * @param {boolean} showNotif
   */
  async function deleteNotePermanently(name, showNotif) {
    if (!canDeleteNote(name)) {
      showWarning(`Can't delete special note ${name}`);
      console.log("cannot delete note:", name);
      return;
    }

    await closeTabWithName(name);
    console.log("deleted note", name);
    await deleteNote(name);
    if (showNotif) {
      showToast(`Deleted note '${name}'`);
    }
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

  function updateDocSize() {
    let editor = getEditor();
    const c = editor.getContent() || "";
    docSize = stringSizeInUtf8Bytes(c);
  }

  /**
   * @param {EdnaEditor} editor
   */
  function autoCreateDayInJournal(editor) {
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

  /**
   * @param {string} name
   * @param {boolean} noPushHistory
   */
  function didLoadNote(name, noPushHistory = false) {
    console.log("didLoadNote:", name);
    throwIf(!name);
    console.log("onDocChanged: just opened");
    let editor = editorRef.getEditor();
    let readOnly = isSystemNoteName(name);
    editor.setReadOnly(readOnly);
    window.document.title = name;
    if (!noPushHistory) {
      addTabToBrowserHistory(name);
      addNoteToHistory(name);
    }
    settings.currentTab = name;
    if (name == kDailyJournalNoteName) {
      // doesn't work without delay
      setTimeout(() => autoCreateDayInJournal(editor), 100);
      // console.log("journal, so going to next block");
      // editor.gotoNextBlock();
    }
    settings.addTab(name);
    updateDocSize();
  }

  function docDidChange() {
    updateDocSize();
  }
  onMount(() => {
    startServerSideEvents();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 grid w-screen max-h-screen h-screen grid-cols-[auto_1fr] grid-rows-[auto_1fr]"
  {oncontextmenu}
>
  {#if settings.alwaysShowTopNav}
    <TopNav
      class="row-start-1 col-start-1 col-span-2"
      {openTab}
      openNote={onOpenNote}
      {closeTab}
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
    debugSyntaxTree={false}
    {didLoadNote}
    {docDidChange}
    bind:this={editorRef}
  />
  {#if currTab.isURL()}
    <div class="row-start-2 col-start-2 z-10 bg-white">
      <iframe title="Preview" src={currTab.value} class="w-full h-full"
      ></iframe>
    </div>
  {/if}
</div>

{#if !settings.alwaysShowTopNav}
  <TopNav
    {openTab}
    openNote={onOpenNote}
    {closeTab}
    {menuItemStatus}
    {onmenucmd}
    {buildMenuDef}
  />
{/if}
<StatusBar
  {line}
  {column}
  {docSize}
  {selectionSize}
  {language}
  {languageAuto}
  {isSpellChecking}
  {formatCurrentBlock}
  {smartRun}
  {toggleSpellCheck}
/>

{#if showingQuickAccess}
  <Overlay onclose={closeDialogs} blur={true}>
    <QuickAccess openNote={onOpenNote} forHistory={true} />
  </Overlay>
{/if}

{#if showingCreateNewNote}
  <Overlay onclose={closeDialogs} blur={true}>
    <CreateNewNote createNewNote={onCreateNote} onclose={closeDialogs}
    ></CreateNewNote>
  </Overlay>
{/if}

{#if showingBlockSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <BlockSelector
      view={blockView}
      blocks={blockItems}
      selectBlock={fnSelectBlock}
      initialSelection={initialBlockSelection}
    ></BlockSelector>
  </Overlay>
{/if}

{#if showingFunctionSelector}
  <Overlay onclose={closeDialogs} blur={true}>
    <FunctionSelector context={functionContext} {userFunctions} {runFunction}
    ></FunctionSelector>
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

{#if modalInfoState.isShowing}
  <ModalInfo />
{/if}

{#if modalMessageState.isShowing}
  <ModalMessage />
{/if}

{#if showingRenameNote}
  <Overlay onclose={closeDialogs} blur={true}>
    <RenameNote
      onclose={closeDialogs}
      rename={onRename}
      oldName={currTab.value}
    />
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
    <Menu
      {menuItemStatus}
      {onmenucmd}
      menuDef={contextMenuDef}
      pos={contextMenuPos}
    />
  </Overlay>
{/if}

{#if showingFindInNotes}
  <Overlay blur={true} onclose={closeDialogs}>
    <FindInNotes openNote={openNoteFromFind}></FindInNotes>
  </Overlay>
{/if}

{#if showingEncryptPassword}
  <Overlay onclose={closeDialogs} blur={true}>
    <EnterEncryptPassword onclose={closeDialogs} onpassword={onEncryptPassword}
    ></EnterEncryptPassword>
  </Overlay>
{/if}

{#if showingDecryptPassword}
  <Overlay onclose={closeDialogs} blur={true}>
    <EnterDecryptPassword
      msg={showingDecryptMessage}
      onpassword={onDecryptPassword}
    ></EnterDecryptPassword>
  </Overlay>
{/if}

{#if showingAskAI}
  <Overlay blur={true} onclose={closeDialogs}>
    <AskAI
      close={closeDialogs}
      startText={askAIStartText}
      insertResponse={insertAskAIResponse}
    ></AskAI>
  </Overlay>
{/if}

{#if appState.showingLogin}
  <Overlay blur={true} onclose={closeDialogs}>
    <Login onclose={() => (appState.showingLogin = false)} />
  </Overlay>
{/if}
