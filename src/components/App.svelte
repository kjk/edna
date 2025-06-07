<script>
  import RenameNote from "./RenameNote.svelte";
  import History from "./History.svelte";
  import NoteSelector from "./NoteSelector.svelte";
  import NoteSelector2 from "./NoteSelector2.svelte";
  import NoteSelectorWide from "./NoteSelectorWide.svelte";
  import LanguageSelector from "./LanguageSelector.svelte";
  import Editor from "./Editor.svelte";
  import ModalMessage, {
    clearModalMessage,
    modalMessageState,
    showModalMessageHTML,
  } from "./ModalMessage.svelte";
  import StatusBar from "./StatusBar.svelte";
  import TopNav from "./TopNav.svelte";
  import Settings from "./Settings.svelte";
  import Toaster, { showError, showToast, showWarning } from "./Toaster.svelte";
  import EnterEncryptPassword from "./EnterEncryptPassword.svelte";
  import EnterDecryptPassword from "./EnterDecryptPassword.svelte";
  import BlockSelector from "./BlockSelector.svelte";
  import Menu, {
    kMenuIdJustText,
    kMenuSeparator,
    kMenuStatusDisabled,
    kMenuStatusNormal,
    kMenuStatusRemoved,
  } from "../Menu.svelte";
  import Overlay from "./Overlay.svelte";
  import CreateNewNote from "./CreateNewNote.svelte";

  import { getSettings, onSettingsChange, setSetting } from "../settings";
  import { logAppExit, logAppOpen, logNoteOp } from "../log";
  import {
    createNewScratchNote,
    createNoteWithName,
    dbDelDirHandle,
    deleteNote,
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
    isUsingEncryption,
    encryptAllNotes,
    decryptAllNotes,
    kWelcomeSystemNoteName,
    kWelcomeDevSystemNoteName,
    kBuiltInFunctionsNoteName,
    createIfNotExists,
    kMyFunctionsNoteName,
    loadNoteIfExists,
    debugRemoveLocalStorageNotes,
    noteExists,
    kEdnaFileExt,
    rememberOpenedNote,
    appendToNote,
  } from "../notes";
  import {
    getNoteMeta,
    getNotesMetadata,
    toggleNoteStarred,
  } from "../metadata";
  import {
    getAltChar,
    getClipboardText,
    hasClipboardPermissions,
    isAltNumEvent,
    isDev,
    len,
    pushHistory,
    stringSizeInUtf8Bytes,
    throwIf,
    trimPrefix,
    trimSuffix,
  } from "../util";
  import {
    supportsFileSystem,
    openDirPicker,
    fsFileHandleWriteBlob,
    hasHandlePermission,
  } from "../fileutil";
  import { boot } from "../webapp-boot";
  import {
    extForLang,
    getLanguage,
    langSupportsFormat,
    langSupportsRun,
  } from "../editor/languages";
  import { browserDownloadBlob, exportNotesToZip } from "../notes-export";
  import { setGlobalFuncs } from "../globals";
  import CommandPalette from "./CommandPalette.svelte";
  import CommandPalette2 from "./CommandPalette2.svelte";
  import Find from "./Find.svelte";
  import FunctionSelector from "./FunctionSelector.svelte";
  import { dirtyState } from "../state.svelte";
  import {
    formatBlockContent,
    insertAfterActiveBlock,
  } from "../editor/block/format-code";
  import { getCurrentSelection, isReadOnly } from "../editor/cmutils";
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
    selectAll,
  } from "../editor/block/commands";
  import {
    getActiveNoteBlock,
    getBlockN,
    getBlocksInfo,
  } from "../editor/block/block";
  import { EdnaEditor, getContent, setReadOnly } from "../editor/editor";
  import { EditorSelection, EditorState } from "@codemirror/state";
  import { parseUserFunctions, runBoopFunction } from "../functions";
  import { getMyFunctionsNote } from "../system-notes";
  import { evalResultToString, runGo, runJS, runJSWithArg } from "../run";
  import { toFileName } from "../filenamify";
  import { tick } from "svelte";
  import AskFileWritePermissions from "./AskFileWritePermissions.svelte";
  import { searchPanelOpen } from "@codemirror/search";

  /** @typedef {import("../functions").BoopFunction} BoopFunction */

  let initialSettings = getSettings();

  let column = $state(1);
  let docSize = $state(0);
  let language = $state("plaintext");
  let languageAuto = $state(true);
  let line = $state(1);
  let noteName = $state(initialSettings.currentNoteName);
  let selectionSize = $state(0);
  let settings = $state(initialSettings);
  let showingMenu = $state(false);
  let showingLanguageSelector = $state(false);
  let showingNoteSelector = $state(false);
  let showingBlockMoveSelector = $state(false);
  let showingNoteSelector2 = $state(false);
  let showingCommandPalette = $state(false);
  let showingCommandPalette2 = $state(false);
  let showingCreateNewNote = $state(false);
  let showingFunctionSelector = $state(false);
  let functionContext = $state("");
  let runFunctionOnSelection = false;
  let userFunctions = $state([]); // note: $state() not needed
  let showingSettings = $state(false);
  let showingRenameNote = $state(false);
  let showingHistorySelector = $state(false);
  let showingBlockSelector = $state(false);
  let showingFind = $state(false);
  let isSpellChecking = $state(false);
  let altChar = getAltChar();
  let useWideSelectors = $state(initialSettings.useWideSelectors);

  let contextMenuPos = $state({ x: 0, y: 0 });

  // /** @type {import("../editor/editor").EdnaEditor} */
  // let ednaEditor = $state(null);

  /** @type {Editor} */
  let editor;

  $effect(() => {
    console.log("showingCreateNewNote changed to:", showingCreateNewNote);
  });

  /**
   * @param {import("../settings").Settings} settings
   */
  function updateForSettings(settings) {
    console.log("updateForSettings");
    useWideSelectors = settings.useWideSelectors;
  }
  onSettingsChange(updateForSettings);

  let isShowingDialog = $derived.by(() => {
    return (
      showingHistorySelector ||
      showingLanguageSelector ||
      showingMenu ||
      showingRenameNote ||
      showingNoteSelector ||
      showingNoteSelector2 ||
      showingBlockMoveSelector ||
      showingCreateNewNote ||
      showingCommandPalette ||
      showingCommandPalette2 ||
      showingCreateNewNote ||
      showingBlockSelector ||
      showingDecryptPassword ||
      showingEncryptPassword ||
      showingAskFileWritePermissions ||
      showingFind ||
      showingSettings
    );
  });

  let gf = {
    openSettings: openSettings,
    openLanguageSelector: openLanguageSelector,
    openCreateNewNote: openCreateNewNote,
    openNoteSelector: openNoteSelector,
    openCommandPalette: openCommandPalette,
    openHistorySelector: openHistorySelector,
    createScratchNote: createScratchNote,
    openBlockSelector: openBlockSelector,
    openFunctionSelector: openFunctionSelector,
    smartRun: smartRun,
    getPassword: getPassword,
    requestFileWritePermission: requestFileWritePermission,
  };
  setGlobalFuncs(gf);

  let noteShortcut = $derived.by(() => {
    let name = noteName;
    let m = getNoteMeta(name);
    if (m && m.altShortcut) {
      return `${altChar} + ${m.altShortcut}`;
    }
    return "";
  });
  $effect(() => {
    getEditorComp().setSpellChecking(isSpellChecking);
  });

  $effect(() => {
    // console.log("App.svelte did mount");
    // capture: true so that we get those before codemirror can process it
    window.addEventListener("keydown", onKeyDown, { capture: true });

    window.addEventListener("beforeunload", async (ev) => {
      // I would prevent to just save the content but
      // async write to disk doesn't seem to get executed
      /*
        let e = getEditor();
        if (e) {
          await e.saveCurrentNote();
        }
      */

      if (dirtyState.isDirty) {
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
      if (isShowingDialog) {
        return;
      }
      // don't process if codemirror is showing search panel
      let view = getEditorView();
      if (view && searchPanelOpen(view.state)) {
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();

      openNoteSelector2();
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
      // console.log("onKeyDown: e:", e, "altN:", altN)
      if (altN) {
        let notes = getNotesMetadata();
        for (let note of notes) {
          if (note.altShortcut == altN && note.name !== noteName) {
            // console.log("onKeyDown: opening note: ", o.name, " altN:", altN, " e:", e)
            openNote(note.name);
            ev.preventDefault();
            return;
          }
        }
      }
    }

    // hack: stop Ctrl + O unless it originates from code mirror (because then it
    // triggers NoteSelector.vue)
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

  let showingDecryptPassword = $state(false);
  let showingDecryptMessage = $state("");
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
  let showingAskFileWritePermissions = $state(false);
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
    let view = getEditorView();
    let bi = getBlocksInfo(view.state);
    let block = getActiveNoteBlock(view.state);
    let ext = extForLang(block.language.name);
    let name = toFileName(settings.currentNoteName) + `-${bi.active}.` + ext;
    let s = view.state.sliceDoc(block.content.from, block.content.to);
    console.log("exportCurrentBlock:", name);
    const blob = new Blob([s], { type: "text/plain" });
    await exportBlobToFile(blob, name);
  }

  async function exportCurrentNote() {
    let settings = getSettings();
    let fileName = toFileName(settings.currentNoteName) + kEdnaFileExt;
    let view = getEditorView();
    let s = getContent(view);
    console.log("exportCurrentNote:", fileName);
    const blob = new Blob([s], { type: "text/plain" });
    await exportBlobToFile(blob, fileName);
  }

  function openSettings() {
    showingSettings = true;
  }

  function closeSettings() {
    showingSettings = false;
    getEditorView().focus();
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
    let view = getEditorView();
    let blocks = getEditor().getBlocks();
    let activeBlock = getActiveNoteBlock(view.state);
    let content = getContent(view);
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

  function closeBlockSelector() {
    showingBlockSelector = false;
    getEditorComp().focus();
  }

  function openCreateNewNote() {
    showingCreateNewNote = true;
  }

  function selectBlock(blockItem) {
    // console.log("selectBlock", $state.snapshot(blockItem));
    let n = blockItem.key;
    let view = getEditorView();
    gotoBlock(view, n);
    closeBlockSelector();
  }

  function closeCreateNewNote() {
    showingCreateNewNote = false;
    getEditorComp().focus();
  }

  function switchToNoteSelector() {
    if (showingCommandPalette) {
      showingCommandPalette = false;
      openNoteSelector();
    } else {
      showingCommandPalette2 = false;
      openNoteSelector2();
    }
  }

  function switchToCommandPalette() {
    if (showingNoteSelector) {
      showingNoteSelector = false;
      openCommandPalette();
    } else {
      showingNoteSelector2 = false;
      openCommandPalette2();
    }
  }

  function openNoteSelector() {
    showingNoteSelector = true;
  }

  function closeNoteSelector() {
    showingNoteSelector = false;
    getEditorComp().focus();
  }

  function reOpenNoteSelector() {
    showingNoteSelector = false;
    tick().then(() => {
      showingNoteSelector = true;
    });
  }

  function openNoteSelector2() {
    showingNoteSelector2 = true;
  }

  function closeNoteSelector2() {
    showingNoteSelector2 = false;
    getEditorComp().focus();
  }

  function switchToWideNoteSelector() {
    useWideSelectors = true;
    setSetting("useWideSelectors", true);
    reOpenNoteSelector();
  }

  async function switchToRegularNoteSelector() {
    useWideSelectors = false;
    setSetting("useWideSelectors", false);
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

  function closeFunctionSelector() {
    showingFunctionSelector = false;
    getEditorComp().focus();
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

  function closeLanguageSelector() {
    showingLanguageSelector = false;
    getEditorComp().focus();
  }

  function openFind() {
    showingFind = true;
  }

  function closeFind() {
    showingFind = false;
    getEditorComp().focus();
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
  export const kCmdCreateNewNote = nmid();
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

  function buildMenuDef() {
    // let starAction = "Star";
    let starAction = "Add to favorites";
    let meta = getNoteMeta(noteName);
    if (meta && meta.isStarred) {
      //starAction = "Un-star";
      starAction = "Remove from favorites";
    }

    const menuNote = [
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
      ["Change language\tMod + L", kCmdChangeBlockLanguage],
      ["Select all text\tMod + A", kCmdBlockSelectAll],
      ["Format as " + language + "\tAlt + Shift + F", kCmdFormatBlock],
      ["Export to file", kCmdExportCurrentBlock],
      ["Delete", kCmdBlockDelete],
      ["Move to another note", kCmdMoveBlock],
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
      ["Command Palette\tMod + Shift + P", kCmdCommandPalette],
      ["Open note\tMod + P", kCmdOpenNote],
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
    let mid = mi[1];
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

    if (mid === kCmdFormatBlock) {
      if (readOnly || !langSupportsFormat(lang)) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdMoveBlock) {
      if (readOnly) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdRunBlock) {
      if (readOnly || !langSupportsRun(lang)) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdRunBlockWithAnotherBlock) {
      if (readOnly || lang.token !== "javascript") {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdRunBlockWithClipboard) {
      if (readOnly || lang.token !== "javascript") {
        return kMenuStatusDisabled;
      }
      // it would be nice to check clipboard for empty text but that triggers clipboard
      // permissions dialog https://github.com/kjk/edna/issues/81
      // if (!mostRecentHasClipboardText) {
      //   return kMenuStatusDisabled;
      // }
    } else if (mid === kCmdSmartRun) {
      if (readOnly) {
        return kMenuStatusDisabled;
      }
    } else if (mid === kCmdOpenNoteFromDisk) {
      if (!hasFS) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdMoveNotesToDirectory) {
      if (!hasFS) {
        return kMenuStatusRemoved;
      }
      if (dh) {
        // currently using directory
        return kMenuStatusRemoved;
      }
    } else if (mid == kCmdSwitchToLocalStorage) {
      if (!hasFS) {
        return kMenuStatusRemoved;
      }
      if (dh === null) {
        // currently using local storage
        return kMenuStatusRemoved;
      }
    } else if (mid == kCmdSwitchToNotesInDir) {
      if (!hasFS) {
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
      if (readOnly) {
        return kMenuStatusDisabled;
      }
      if (mid === kCmdRunFunctionWithSelection && !hasSelection()) {
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
    showingMenu = false;
    let view = getEditorView();
    if (cmdId === kCmdCommandPalette) {
      openCommandPalette();
    } else if (cmdId === kCmdOpenNote) {
      openNoteSelector();
    } else if (cmdId === kCmdCreateNewNote) {
      openCreateNewNote();
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
    } else if (cmdId === kCmdExportCurrentBlock) {
      await exportCurrentBlock();
      view.focus();
    } else if (cmdId === kCmdBlockDelete) {
      deleteBlock(view);
      view.focus();
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
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    contextMenuDef = buildMenuDef();
    contextMenuPos = pos || { x: ev.x, y: ev.y };
    showingMenu = true;
  }

  function closeMenu() {
    showingMenu = false;
    getEditorComp().focus();
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
    ["Open recent note", kCmdOpenRecent],
    ["Open note from disk", kCmdOpenNoteFromDisk],
    // ["Export current note", kCmdExportCurrentNote],
  ];

  function buildCommandPaletteDef() {
    commandsDef = buildCommandsDef();
    commandsDef.push(...commandPaletteAdditions);
    let name = commandNameOverride(kCmdToggleSpellChecking);
    commandsDef.push([name, kCmdToggleSpellChecking]);
  }

  function openCommandPalette() {
    buildCommandPaletteDef();
    showingCommandPalette = true;
  }

  function closeCommandPalette() {
    showingCommandPalette = false;
    getEditorComp().focus();
  }

  function openCommandPalette2() {
    buildCommandPaletteDef();
    showingCommandPalette2 = true;
  }

  function closeCommandPalette2() {
    showingCommandPalette2 = false;
    getEditorComp().focus();
  }

  async function executeCommand(cmdId) {
    console.log("executeCommand:", cmdId);
    showingCommandPalette = false;
    showingCommandPalette2 = false;
    onmenucmd(cmdId);
  }

  /**
   * @returns {Editor}
   */
  function getEditorComp() {
    return editor;
  }

  /**
   * @returns {EdnaEditor}
   */
  function getEditor() {
    return editor.getEditor();
  }

  /**
   * @returns {import("@codemirror/view").EditorView}
   */
  function getEditorView() {
    if (!editor) {
      return null;
    }
    let view = editor.getEditorView();
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

    const content = state.sliceDoc(block.content.from, block.content.to);

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
    view = getEditorView();
    view.focus();
    logNoteOp("runBlock");
  }

  let fnSelectBlock = $state(null);

  function runBlockWithAnotherBlock(argBlockItem) {
    console.log(argBlockItem);
    closeBlockSelector();
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

  function closeRename() {
    showingRenameNote = false;
    getEditorComp().focus();
  }

  async function onRename(newName) {
    showingRenameNote = false;
    let view = getEditorView();
    let s = getContent(view) || "";
    await renameNote(noteName, newName, s);
    await openNote(newName, true);
    // console.log("onRename: newName:", newName);
  }

  function openHistorySelector() {
    showingHistorySelector = true;
    getEditorComp().focus();
  }

  function closeHistorySelector() {
    showingHistorySelector = false;
    getEditorComp().focus();
  }

  function onSelectHistory(name) {
    // console.log("onSelectHistory:", name);
    closeHistorySelector();
    if (name != noteName) {
      openNote(name);
    } else {
      // console.log("onSelectHistory: skipping opening becase same note");
    }
  }

  /**
   * @param {string} name
   * @param {boolean} skipSave
   * @param {boolean} noPushHistory
   */
  async function openNote(name, skipSave = false, noPushHistory = false) {
    console.log("App.openNote:", name);
    let editor = getEditorComp();
    editor.setReadOnly(true);
    let msg = `Loading <span class="font-bold">${name}</span>...`;
    showModalMessageHTML(msg, 300);
    await editor.openNote(name, skipSave, noPushHistory);
    // await sleep(400);
    clearModalMessage();
    getEditorComp().focus();
  }

  /**
   * @param {string} name
   */
  function onOpenNote(name) {
    showingNoteSelector = false;
    showingNoteSelector2 = false;
    openNote(name);
  }

  function moveCurrentBlock() {
    showingBlockMoveSelector = true;
  }

  function closeBlockMoveSelector() {
    showingBlockMoveSelector = false;
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
    deleteBlock(view);
    view.focus();
  }

  /**
   * @param {string} name
   */
  async function onCreateNote(name) {
    showingNoteSelector = false;
    showingNoteSelector2 = false;
    showingCreateNewNote = false;
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
    let view = getEditorView();
    const c = getContent(view) || "";
    docSize = stringSizeInUtf8Bytes(c);
  }

  /**
   * @param {string} name
   * @param {boolean} noPushHistory
   */
  function didOpenNote(name, noPushHistory = false) {
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
    if (!noPushHistory) {
      pushHistory(name);
    }
    setSetting("currentNoteName", name);
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
  class="grid w-screen max-h-screen h-screen fixed grid-rows-[1fr_auto]"
  {oncontextmenu}
>
  <TopNav {noteName} shortcut={noteShortcut} selectHistory={onSelectHistory} />
  <Editor
    cursorChange={onCursorChange}
    debugSyntaxTree={false}
    keymap={settings.keymap}
    emacsMetaKey={settings.emacsMetaKey}
    showLineNumberGutter={settings.showLineNumberGutter}
    showFoldGutter={settings.showFoldGutter}
    bracketClosing={settings.bracketClosing}
    fontFamily={settings.fontFamily}
    fontSize={settings.fontSize}
    bind:this={editor}
    {didOpenNote}
    {docDidChange}
  />
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
</div>

{#if showingCreateNewNote}
  <Overlay onclose={closeCreateNewNote} blur={true}>
    <CreateNewNote createNewNote={onCreateNote} onclose={closeCreateNewNote}
    ></CreateNewNote>
  </Overlay>
{/if}

{#if showingBlockSelector}
  <Overlay onclose={closeBlockSelector} blur={true}>
    <BlockSelector
      blocks={blockItems}
      selectBlock={fnSelectBlock}
      initialSelection={initialBlockSelection}
    ></BlockSelector>
  </Overlay>
{/if}

{#if showingFunctionSelector}
  <Overlay onclose={closeFunctionSelector} blur={true}>
    <FunctionSelector context={functionContext} {userFunctions} {runFunction}
    ></FunctionSelector>
  </Overlay>
{/if}

{#if showingBlockMoveSelector}
  <Overlay onclose={closeBlockMoveSelector} blur={true}>
    <NoteSelector
      header="Move current block to note:"
      forMoveBlock={true}
      openNote={onMoveBlockToNote}
      createNote={onMoveBlockToNote}
    />
  </Overlay>
{/if}

{#if showingNoteSelector}
  {#if useWideSelectors}
    <Overlay onclose={closeNoteSelector} blur={true}>
      <NoteSelectorWide
        {switchToRegularNoteSelector}
        {switchToCommandPalette}
        openNote={onOpenNote}
        createNote={onCreateNote}
        deleteNote={onDeleteNote}
      />
    </Overlay>
  {:else}
    <Overlay onclose={closeNoteSelector} blur={true}>
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

{#if showingNoteSelector2}
  <NoteSelector2
    {switchToCommandPalette}
    onclose={closeNoteSelector2}
    openNote={onOpenNote}
    createNote={onCreateNote}
    deleteNote={onDeleteNote}
  />
{/if}

{#if showingLanguageSelector}
  <Overlay onclose={closeLanguageSelector} blur={true}>
    <LanguageSelector selectLanguage={onSelectLanguage} />
  </Overlay>
{/if}

{#if showingHistorySelector}
  <Overlay onclose={closeHistorySelector} blur={true}>
    <History selectHistory={onSelectHistory} />
  </Overlay>
{/if}

{#if modalMessageState.isShowing}
  <ModalMessage />
{/if}

{#if showingRenameNote}
  <Overlay onclose={closeRename} blur={true}>
    <RenameNote onclose={closeRename} rename={onRename} oldName={noteName} />
  </Overlay>
{/if}

{#if showingSettings}
  <Overlay onclose={closeSettings} blur={true}>
    <Settings></Settings>
  </Overlay>
{/if}
<Toaster></Toaster>

{#if showingCommandPalette}
  <Overlay onclose={closeCommandPalette} blur={true}>
    <CommandPalette {commandsDef} {executeCommand} {switchToNoteSelector} />
  </Overlay>
{/if}

{#if showingCommandPalette2}
  <CommandPalette2
    onclose={closeCommandPalette2}
    {commandsDef}
    {executeCommand}
    {switchToNoteSelector}
  />
{/if}

{#if showingFind}
  <Find></Find>
{/if}

{#if showingMenu}
  <Overlay onclose={closeMenu}>
    <Menu
      {menuItemStatus}
      {onmenucmd}
      menuDef={contextMenuDef}
      pos={contextMenuPos}
    />
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
