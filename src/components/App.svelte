<script>
  import { tick } from "svelte";
  import { foldCode, unfoldCode } from "@codemirror/language";
  import { closeSearchPanel, searchPanelOpen } from "@codemirror/search";
  import { EditorSelection, EditorState } from "@codemirror/state";
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
    selectAll,
  } from "../editor/block/commands";
  import {
    formatBlockContent,
    insertAfterActiveBlock,
  } from "../editor/block/format-code";
  import { getCurrentSelection, isReadOnly } from "../editor/cmutils";
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
  import { toFileName } from "../filenamify";
  import {
    fsFileHandleWriteBlob,
    hasHandlePermission,
    openDirPicker,
    supportsFileSystem,
  } from "../fileutil";
  import { parseUserFunctions, runBoopFunction } from "../functions";
  import { setGlobalFuncs } from "../globals";
  import { addNoteToHistory } from "../history";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import Menu, {
    kMenuIdJustText,
    kMenuSeparator,
    kMenuStatusDisabled,
    kMenuStatusNormal,
    kMenuStatusRemoved,
  } from "../Menu.svelte";
  import {
    getNoteMeta,
    getNotesMetadata,
    toggleNoteStarred,
  } from "../metadata";
  import { isMoving } from "../mouse-track.svelte";
  import {
    appendToNote,
    blockHdrMarkdown,
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
    isSystemNoteName,
    isUsingEncryption,
    kBuiltInFunctionsNoteName,
    kDailyJournalNoteName,
    kEdnaFileExt,
    kHelpSystemNoteName,
    kMyFunctionsNoteName,
    kReleaseNotesSystemNoteName,
    kScratchNoteName,
    kWelcomeDevSystemNoteName,
    kWelcomeSystemNoteName,
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
  import { getSettings } from "../settings.svelte";
  import { appState } from "../state.svelte";
  import { getMyFunctionsNote } from "../system-notes";
  import {
    addNoteToBrowserHistory,
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
  import { boot } from "../webapp-boot";
  import AskFileWritePermissions from "./AskFileWritePermissions.svelte";
  import BlockSelector from "./BlockSelector.svelte";
  import CommandPalette from "./CommandPalette.svelte";
  import CreateNewNote from "./CreateNewNote.svelte";
  import Editor from "./Editor.svelte";
  import EnterDecryptPassword from "./EnterDecryptPassword.svelte";
  import EnterEncryptPassword from "./EnterEncryptPassword.svelte";
  import FindInNotes from "./FindInNotes.svelte";
  import FunctionSelector from "./FunctionSelector.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import ModalMessage, {
    clearModalMessage,
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

  /** @typedef {import("../functions").BoopFunction} BoopFunction */

  const isMac = platform.isMac;

  let settings = getSettings();

  let column = $state(1);
  let docSize = $state(0);
  let language = $state("plaintext");
  let languageAuto = $state(true);
  let line = $state(1);
  let noteName = $derived(settings.currentNoteName);
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
  let showingHistorySelector = $state(false);
  let showingBlockSelector = $state(false);
  let showingFindInNotes = $state(false);
  let showingDecryptPassword = $state(false);
  let showingDecryptMessage = $state("");
  let showingAskFileWritePermissions = $state(false);

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
      showingHistorySelector ||
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
    showingCreateNewNote = false;
    showingFunctionSelector = false;
    showingSettings = false;
    showingRenameNote = false;
    showingHistorySelector = false;
    showingBlockSelector = false;
    showingFindInNotes = false;

    appState.forceNewTab = false;

    getEditorComp().focus();
  }

  let isSpellChecking = $state(false);

  let functionContext = $state("");
  let runFunctionOnSelection = false;
  let userFunctions = $state([]); // note: $state() not needed
  let contextMenuPos = $state({ x: 0, y: 0 });

  // /** @type {import("../editor/editor").EdnaEditor} */
  // let ednaEditor = $state(null);

  /** @type {Editor} */
  let editorRef;

  $effect(() => {
    isMoving.disableMoveTracking = isShowingDialog;
  });

  function openFindInNotes() {
    showingFindInNotes = true;
  }

  let gf = {
    openSettings: openSettings,
    openLanguageSelector: openLanguageSelector,
    openCreateNewNote: openCreateNewNote,
    openNoteSelector: openNoteSelector,
    openCommandPalette: openCommandPalette,
    openContextMenu: openContextMenu,
    openFindInNotes: openFindInNotes,
    openHistorySelector: openHistorySelector,
    createScratchNote: createScratchNote,
    openBlockSelector: openBlockSelector,
    openFunctionSelector: openFunctionSelector,
    smartRun: smartRun,
    focusEditor: focusEditor,
    getPassword: getPassword,
    requestFileWritePermission: requestFileWritePermission,
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
      if (!state || !state.noteName) {
        console.log(
          "popstate: state is null or has no 'noteName' field:",
          state,
        );
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

  /**
   * @param {KeyboardEvent} ev
   */
  function onKeyDown(ev) {
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
            showingHistorySelector = false;
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

  let closeDecryptPassword = $state(null);
  let onDecryptPassword = $state(null);

  /**
   * @param {string} [msg]
   * @returns {Promise<string>}
   */
  async function getPassword(msg = "") {
    showingDecryptPassword = true;
    showingDecryptMessage = msg;
    clearModalMessage();
    return new Promise((resolve, reject) => {
      onDecryptPassword = (pwd) => {
        resolve(pwd);
        showingDecryptPassword = false;
      };
      closeDecryptPassword = () => {
        resolve("");
        showingDecryptPassword = false;
      };
    });
  }

  /** @type {FileSystemFileHandle} */
  let fileWritePermissionsFileHandle = $state(null);
  /** @type {(boolean) => void} */
  let askFileWritePermissionsClose = $state(null);

  /**
   * @param {FileSystemFileHandle} fh
   * @returns {Promise<boolean>}
   */
  async function requestFileWritePermission(fh) {
    if (hasHandlePermission(fh, true)) {
      console.log(
        "requestFileWritePermission: already have write permissions to",
        fh,
      );
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

  function onEncryptPassword(pwd) {
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

  /**
   * @param {Blob} blob
   * @param {string} fileName
   */
  async function exportBlobToFile(blob, fileName) {
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
    let name = toFileName(settings.currentNoteName) + `-${bi.active}.` + ext;
    let { from, to } = block.content;
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

  async function deleteCurrentNote() {
    let name = noteName;
    console.log("deleteNote:", name);
    if (!canDeleteNote(name)) {
      showWarning(`Can't delete special note ${name}`);
      console.log("cannot delete note:", name);
      return;
    }
    await openNote(kScratchNoteName, true);
    await deleteNote(name);
    // TODO: add a way to undo deletion of the note
    showToast(`Deleted note '${name}'`);
    logNoteOp("noteDelete");
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

  /**
   * @param {string} c
   * @param {number} from
   * @param {number} to
   * @returns {string}
   */
  function extractBlockTitle(c, from, to) {
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
    let userFunctionsStr = await loadNoteIfExists(kMyFunctionsNoteName);
    if (!userFunctionsStr) {
      userFunctions = [];
    } else {
      userFunctions = parseUserFunctions(userFunctionsStr);
    }
    showingFunctionSelector = true;
  }

  /** @typedef {import("../functions").BoopFunctionArg} BoopFunctionArg*/

  /**
   * @param {BoopFunction} f
   * @param {string} txt
   * @returns {Promise<BoopFunctionArg>}
   */
  export async function runBoopFunctionWithText(f, txt) {
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

  /**
   * @param {EditorView} view
   * @param {BoopFunction} fdef
   * @param {boolean} replace
   * @returns {Promise<boolean>}
   */
  async function runBoopFunctionWithSelection(view, fdef, replace) {
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
        text = "\n∞∞∞text-a\n" + res;
      }
      insertAfterActiveBlock(view, text);
    }
  }

  /** @typedef {import("@codemirror/view").EditorView} EditorView */
  /**
   * @param {EditorView} view
   * @param {BoopFunction} fdef
   * @param {boolean} replace
   * @returns {Promise<boolean>}
   */
  async function runBoopFunctionWithBlockContent(view, fdef, replace) {
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
        text = "\n∞∞∞text-a\n" + res;
      }
      insertAfterActiveBlock(view, text);
    }
  }

  /**
   * @param {BoopFunction} fdef
   * @param {boolean} replace
   */
  async function runFunction(fdef, replace) {
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

  /**
   * @param {string} lang
   */
  function onSelectLanguage(lang) {
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

  export const kCmdCommandPalette = nmid();
  export const kCmdOpenNote = nmid();
  export const kCmdOpenNoteInNewTab = nmid();
  export const kCmdOpenFind = nmid();
  export const kCmdCreateNewNote = nmid();
  export const kCmdCloseCurrentTab = nmid();
  export const kCmdRenameCurrentNote = nmid();
  export const kCmdDeleteCurrentNote = nmid();
  export const kCmdCreateScratchNote = nmid();

  export const kCmdNewBlockAfterCurrent = nmid();
  const kCmdBlockFirst = kCmdNewBlockAfterCurrent;
  export const kCmdGoToBlock = nmid();
  export const kCmdNewBlockBeforeCurrent = nmid();
  export const kCmdNewBlockAtEnd = nmid();
  export const kCmdNewBlockAtStart = nmid();
  export const kCmdBlockDelete = nmid();
  export const kCmdSplitBlockAtCursor = nmid();
  export const kCmdGoToNextBlock = nmid();
  export const kCmdGoToPreviousBlock = nmid();
  export const kCmdChangeBlockLanguage = nmid();
  export const kCmdBlockSelectAll = nmid();
  export const kCmdMoveBlock = nmid();
  export const kCmdToggleBlockFold = nmid();
  export const kCmdFoldBlock = nmid();
  export const kCmdUnfoldBlock = nmid();
  export const kCmdFoldAllBlocks = nmid();
  export const kCmdUnfoldAllBlocks = nmid();
  export const kCmdFoldCode = nmid();
  export const kCmdUnfoldColde = nmid();
  export const kCmdUnfoldEverything = nmid();
  export const kCmdMoveBlockUp = nmid();
  export const kCmdMoveBlockDown = nmid();
  export const kCmdFormatBlock = nmid();
  const kCmdBlockLast = kCmdFormatBlock;

  export const kCmdShowHelp = nmid();
  export const kCmdShowHelpAsNote = nmid();
  export const kCmdShowReleaseNotes = nmid();
  export const kCmdMoveNotesToDirectory = nmid();
  export const kCmdSwitchToNotesInDir = nmid();
  export const kCmdSwitchToLocalStorage = nmid();
  export const kCmdExportNotes = nmid();
  export const kCmdExportCurrentNote = nmid();
  export const kCmdEncryptNotes = nmid();
  export const kCmdDecryptNotes = nmid();
  export const kCmdEncryptionHelp = nmid();
  export const kCmdToggleSpellChecking = nmid();
  export const kCmdShowStorageHelp = nmid();
  export const kCmdSettings = nmid();
  export const kCmdOpenRecent = nmid();
  export const kCmdShowWelcomeNote = nmid();
  export const kCmdShowWelcomeDevNote = nmid();
  export const kCmdSmartRun = nmid();
  export const kCmdRunBlock = nmid();
  export const kCmdRunBlockWithAnotherBlock = nmid();
  export const kCmdRunBlockWithClipboard = nmid();
  export const kCmdRunFunctionWithBlockContent = nmid();
  export const kCmdRunFunctionWithSelection = nmid();
  export const kCmdCreateYourOwnFunctions = nmid();
  export const kCmdShowBuiltInFunctions = nmid();
  export const kCmdRunHelp = nmid();
  export const kCmdExportCurrentBlock = nmid();
  export const kCmdNoteToggleStarred = nmid();
  export const kCmdOpenNoteFromDisk = nmid();
  export const kCmdToggleSidebar = nmid();

  function buildMenuDef() {
    // let starAction = "Star";
    let starAction = "Add to favorites";
    let meta = getNoteMeta(noteName);
    if (meta && meta.isStarred) {
      //starAction = "Un-star";
      starAction = "Remove from favorites";
    }

    const menuNote = [
      ["Close", kCmdCloseCurrentTab],
      ["Rename", kCmdRenameCurrentNote],
      ["Delete", kCmdDeleteCurrentNote],
      [starAction, kCmdNoteToggleStarred],
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

    let dh = getStorageFS();
    let currStorage = "Current store: browser (local storage)";
    if (dh) {
      currStorage = `Current store: directory ${dh.name}`;
    }
    const menuStorage = [
      [currStorage, kMenuIdJustText],
      ["Move notes from browser to directory", kCmdMoveNotesToDirectory],
      ["Switch to browser (local storage)", kCmdSwitchToLocalStorage],
      ["Switch to notes in a directory", kCmdSwitchToNotesInDir],
      kMenuSeparator,
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

  /**
   * @param {import("../Menu.svelte").MenuItemDef} mi
   * @returns {number}
   */
  function menuItemStatus(mi) {
    let mid = /** @type {number} */ (mi[1]);
    if (mid === kMenuIdJustText) {
      return kMenuStatusDisabled;
    }

    // console.log("menuItemStatus:", mi);
    // console.log("s:", s, "mid:", mid);
    // note: this is called for each menu item so should be fast
    let lang = getLanguage(language);
    let dh = getStorageFS();
    // console.log("dh:", dh);
    let hasFS = supportsFileSystem();
    let view = getEditorView();
    let readOnly = isReadOnly(view);

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
    } else if (
      mid === kCmdRunFunctionWithBlockContent ||
      mid === kCmdRunFunctionWithSelection
    ) {
      if (mid === kCmdRunFunctionWithSelection && !hasSelection()) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdCloseCurrentTab) {
      if (len(settings.tabs) < 2) {
        return kMenuStatusDisabled;
      }
    }
    return kMenuStatusNormal;
  }

  /**
   * @returns {boolean} hasSelection
   */
  function hasSelection() {
    let view = getEditorView();
    let { selectedText } = getCurrentSelection(view.state);
    return selectedText != "";
  }

  /**
   * @param {number} cmdId
   * @param ev
   */
  async function onmenucmd(cmdId) {
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
    } else if (cmdId === kCmdCloseCurrentTab) {
      closeCurrentTab();
    } else if (cmdId === kCmdRenameCurrentNote) {
      showingRenameNote = true;
    } else if (cmdId === kCmdDeleteCurrentNote) {
      deleteCurrentNote();
    } else if (cmdId === kCmdCreateScratchNote) {
      await createScratchNote();
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
    } else if (cmdId === kCmdToggleSpellChecking) {
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
    } else if (cmdId === kCmdOpenRecent) {
      openHistorySelector();
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
    } else {
      console.log("unknown menu cmd id");
    }
  }

  async function openCustomFunctionsNote() {
    let content = getMyFunctionsNote();
    await createIfNotExists(kMyFunctionsNoteName, content);
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
    console.warn("openContextMenu: ev:", ev, "pos:", pos);
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    contextMenuDef = buildMenuDef();
    contextMenuPos = pos || { x: ev.x, y: ev.y };
    showingContextMenu = true;
  }

  let commandsDef = $state(null);

  const commandNameOverrides = [
    kCmdRenameCurrentNote,
    "Rename current note",
    kCmdDeleteCurrentNote,
    "Delete current note",
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
  ];

  function commandNameOverride(id, name) {
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
      let meta = getNoteMeta(noteName);
      if (meta && meta.isStarred) {
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

  const commandPaletteAdditions = [
    ["Create New Scratch Note", kCmdCreateScratchNote],
    ["Create New Note", kCmdCreateNewNote],
    ["Open recent note", kCmdOpenRecent],
    ["Open note in new tab", kCmdOpenNoteInNewTab],
    ["Toggle Sidebar", kCmdToggleSidebar],
    ["Open note from disk", kCmdOpenNoteFromDisk],
    ["Block: Fold all blocks", kCmdFoldAllBlocks],
    ["Block: Unfold all blocks", kCmdUnfoldAllBlocks],
    ["Edit: Unfold everything", kCmdUnfoldEverything],
    // ["Export current note", kCmdExportCurrentNote],
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

  function buildCommandPaletteDef() {
    commandsDef = buildCommandsDef();
    commandsDef.push(...commandPaletteAdditions);
    console.log("commandPaletteAdditions:", commandPaletteAdditions);
    let name = commandNameOverride(kCmdToggleSpellChecking);
    commandsDef.push([name, kCmdToggleSpellChecking]);
    if (len(settings.tabs) > 1) {
      commandsDef.push(["Close current tab", kCmdCloseCurrentTab]);
    }
  }

  function closeTab(noteName) {
    if (noteName != settings.currentNoteName) {
      settings.removeTab(noteName);
      return;
    }
    let idx = settings.tabs.indexOf(noteName);
    settings.removeTab(noteName);
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

  function openCommandPalette() {
    buildCommandPaletteDef();
    showingCommandPalette = true;
  }

  async function executeCommand(cmdId) {
    console.log("executeCommand:", cmdId);
    showingCommandPalette = false;
    onmenucmd(cmdId);
  }

  /**
   * @returns {Editor}
   */
  function getEditorComp() {
    return editorRef;
  }

  /**
   * @returns {EdnaEditor}
   */
  function getEditor() {
    return editorRef.getEditor();
  }

  /**
   * @returns {import("@codemirror/view").EditorView}
   */
  function getEditorView() {
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
    toggleNoteStarred(noteName);
    getEditor().focus();
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
    clearModalMessage();

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

    let { selectedText } = getCurrentSelection(view.state);
    let hasSelection = selectedText !== "";
    let supportsRun = currentBlockSupportsRun(view.state);
    console.log(
      `smartRun: hasSelection=${hasSelection} supportsRun=${supportsRun}`,
    );
    if (hasSelection) {
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
  function showHTMLHelp(anchor = "") {
    // let uri = window.location.origin + "/help"
    let uri = "/help";
    if (anchor != "") {
      uri += anchor;
    }
    window.open(uri, "_blank");
  }

  async function onRename(newName) {
    closeDialogs();
    let editor = getEditor();
    let s = editor.getContent() || "";
    await renameNote(noteName, newName, s);
    await openNote(newName, true);
    // console.log("onRename: newName:", newName);
  }

  function openHistorySelector() {
    showingHistorySelector = true;
  }

  /**
   * @param {string} name
   */
  async function onOpenNote(name, newTab = false) {
    // must get before closeDialg()
    let forceNewTab = appState.forceNewTab;

    closeDialogs();
    if (name == settings.currentNoteName) {
      return;
    }
    console.warn("onOpenNote: name:", name, "newTab:", newTab);
    if (forceNewTab) {
      newTab = true;
      console.warn("forcing new tab");
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
    clearModalMessage();
    getEditorComp().focus();
  }

  function openNoteFind(name, pos) {
    closeDialogs();
    openNote(name).then(() => {
      // TODO: this is not reliable, must pass pos down via openNote()
      setTimeout(() => {
        console.warn("openNoteFind: setting pos:", pos);
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
   */
  async function onDeleteNote(name) {
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
    // getEditorComp().focus();
    console.log("deleted note", name);
    // TODO: add a way to undo deletion of the note
    showToast(`Deleted note '${name}'`);
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
    settings.addTab(name);
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
  class="fixed inset-0 grid w-screen max-h-screen h-screen grid-cols-[auto_1fr] grid-rows-[1fr_auto]"
  {oncontextmenu}
>
  {#if settings.alwaysShowTopNav}
    <TopNav
      class="row-start-1 col-start-1 col-span-2"
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
</div>

{#if !settings.alwaysShowTopNav}
  <TopNav
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

{#if showingHistorySelector}
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
        createNote={onCreateNote}
        deleteNote={onDeleteNote}
      />
    </Overlay>
  {:else}
    <Overlay onclose={closeDialogs} blur={true}>
      <NoteSelector
        {switchToWideNoteSelector}
        {switchToCommandPalette}
        openNote={onOpenNote}
        createNote={onCreateNote}
        deleteNote={onDeleteNote}
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
    <FindInNotes openNote={openNoteFind}></FindInNotes>
  </Overlay>
{/if}

{#if showingEncryptPassword}
  <Overlay onclose={closeEncryptPassword} blur={true}>
    <EnterEncryptPassword
      onclose={closeEncryptPassword}
      onpassword={onEncryptPassword}
    ></EnterEncryptPassword>
  </Overlay>
{/if}

{#if showingDecryptPassword}
  <Overlay onclose={closeDecryptPassword} blur={true}>
    <EnterDecryptPassword
      msg={showingDecryptMessage}
      onpassword={onDecryptPassword}
    ></EnterDecryptPassword>
  </Overlay>
{/if}

{#if showingAskFileWritePermissions}
  <Overlay noCloseOnEsc={true} blur={true}>
    <AskFileWritePermissions
      fileHandle={fileWritePermissionsFileHandle}
      close={askFileWritePermissionsClose}
    ></AskFileWritePermissions>
  </Overlay>
{/if}
