<script>
  import RenameNote from "./RenameNote.svelte";
  import History from "./History.svelte";
  import NoteSelector from "./NoteSelector.svelte";
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
  import Toaster, { addToast } from "./Toaster.svelte";
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

  import { getSettings, setSetting } from "../settings";
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
    isUsingEncryption,
    encryptAllNotes,
    decryptAllNotes,
    kWelcomeSystemNoteName,
    kWelcomeDevSystemNoteName,
  } from "../notes";
  import {
    getAltChar,
    isAltNumEvent,
    isDev,
    len,
    setURLHashNoReload,
    stringSizeInUtf8Bytes,
    throwIf,
    trimPrefix,
    trimSuffix,
  } from "../util";
  import { supportsFileSystem, openDirPicker } from "../fileutil";
  import { boot } from "../webapp-boot";
  import {
    getLanguage,
    langSupportsFormat,
    langSupportsRun,
  } from "../editor/languages";
  import { exportNotesToZip, maybeBackupNotes } from "../notes-export";
  import { setGlobalFuncs } from "../globals";
  import CommandPalette from "./CommandPalette.svelte";
  import Find from "./Find.svelte";

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
  let showingCommandPalette = $state(false);
  let showingCreateNewNote = $state(false);
  let showingSettings = $state(false);
  let showingRenameNote = $state(false);
  let showingHistorySelector = $state(false);
  let showingBlockSelector = $state(false);
  let showingFind = $state(false);
  let isSpellChecking = $state(false);
  let altChar = getAltChar();

  let contextMenuPos = $state({ x: 0, y: 0 });

  // /** @type {import("../editor/editor").EdnaEditor} */
  // let ednaEditor = $state(null);

  /** @type {Editor} */
  let editor;

  $effect(() => {
    console.log("showingNoteSelector changed to:", showingNoteSelector);
  });

  let isShowingDialog = $derived.by(() => {
    return (
      showingHistorySelector ||
      showingLanguageSelector ||
      showingMenu ||
      showingRenameNote ||
      showingNoteSelector ||
      showingCommandPalette ||
      showingCreateNewNote ||
      showingBlockSelector ||
      showingDecryptPassword ||
      showingEncryptPassword ||
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
    openContextMenu: openContextMenu,
    openBlockSelector: openBlockSelector,
    getPassword: getPassword,
  };
  setGlobalFuncs(gf);

  let noteShortcut = $derived.by(() => {
    let name = noteName;
    let m = getMetadataForNote(name);
    if (m && m.altShortcut) {
      return `${altChar} + ${m.altShortcut}`;
    }
    return "";
  });
  $effect(() => {
    getEditor().setSpellChecking(isSpellChecking);
  });

  $effect(() => {
    console.log("App.svelte did mount");
    maybeBackupNotes();
    window.addEventListener("keydown", onKeyDown);

    window.addEventListener("beforeunload", async () => {
      logAppExit(); // TODO: not sure if this async func will complete
      let e = getEditor();
      if (e) {
        await e.saveCurrentNote();
      }
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
    // if (event.key === "Escape") {
    //   if (isShowingDialog) {
    //     return;
    //   }
    //   event.preventDefault();
    //   event.stopImmediatePropagation();
    //   openHistorySelector();
    //   return;
    // }

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
      let altN = isAltNumEvent(ev);
      // console.log("onKeyDown: e:", e, "altN:", altN)
      if (altN) {
        let meta = getNotesMetadata();
        for (let o of meta) {
          if (o.altShortcut == altN && o.name !== noteName) {
            // console.log("onKeyDown: opening note: ", o.name, " altN:", altN, " e:", e)
            openNote(o.name);
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
  let closeDecryptPassword = () => {
    console.log("empty closeDecryptPassword");
  };
  let onDecryptPassword = (pwd) => {
    console.log("onDecryptPassword:", pwd);
  };

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

  let showingEncryptPassword = $state(false);
  function openEncryptPassword() {
    showingEncryptPassword = true;
  }
  function closeEncryptPassword() {
    showingEncryptPassword = false;
    getEditor().focus();
  }
  function onEncryptPassword(pwd) {
    console.log("got encryption password:", pwd);
    closeEncryptPassword();
    encryptAllNotes(pwd);
  }

  function exportNotesToZipFile() {
    exportNotesToZip();
  }

  function openSettings() {
    showingSettings = true;
  }

  function onCloseSettings() {
    showingSettings = false;
    getEditor().focus();
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
    addToast(`Deleted note '${name}'`);
    logNoteOp("noteDelete");
  }

  async function createScratchNote() {
    let name = await createNewScratchNote();
    await onOpenNote(name);
    // TODO: add a way to undo creation of the note
    addToast(`Created scratch note '${name}'`);
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

  function openBlockSelector() {
    let blocks = getEditor().getBlocks();
    let activeBlock = getEditor().getActiveNoteBlock();
    let c = getEditor().getContent();
    /** @type {import("./BlockSelector.svelte").Item[]} */
    let items = [];
    let blockNo = 0;
    let currBlockNo = 0;
    for (let b of blocks) {
      let title = extractBlockTitle(c, b.content.from, b.content.to);
      console.log("block title:", title);
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
    getEditor().focus();
  }

  function openCreateNewNote() {
    showingCreateNewNote = true;
  }

  function selectBlock(blockItem) {
    console.log(blockItem);
    let n = blockItem.key;
    getEditor().gotoBlock(n);
    closeBlockSelector();
  }

  function closeCreateNewNote() {
    showingCreateNewNote = false;
    getEditor().focus();
  }

  function switchToNoteSelector() {
    console.log("switch to note selector");
    showingCommandPalette = false;
    openNoteSelector();
  }

  function switchToCommandPalette() {
    console.log("Switch to command palette");
    showingNoteSelector = false;
    openCommandPalette();
  }

  function openNoteSelector() {
    showingNoteSelector = true;
  }

  function closeNoteSelector() {
    showingNoteSelector = false;
    getEditor().focus();
  }

  function openLanguageSelector() {
    showingLanguageSelector = true;
  }

  function closeLanguageSelector() {
    showingLanguageSelector = false;
    getEditor().focus();
  }

  function openFind() {
    showingFind = true;
  }

  function closeFind() {
    showingFind = false;
    getEditor().focus();
  }

  function onSelectLanguage(language) {
    showingLanguageSelector = false;
    getEditor().setLanguage(language);
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
  console.log("kCmdGoToBlock:", kCmdGoToBlock);
  export const kCmdNewBlockBeforeCurrent = nmid();
  export const kCmdNewBlockAtEnd = nmid();
  export const kCmdNewBlockAtStart = nmid();
  export const kCmdSplitBlockAtCursor = nmid();
  export const kCmdGoToNextBlock = nmid();
  export const kCmdGoToPreviousBlock = nmid();
  export const kCmdChangeBlockLanguage = nmid();
  export const kCmdBlockSelectAll = nmid();
  export const kCmdFormatBlock = nmid();
  export const kCmdRunBlock = nmid();
  const kCmdBlockLast = kCmdRunBlock;

  export const kCmdShowHelp = nmid();
  export const kCmdShowHelpAsNote = nmid();
  export const kCmdShowReleaseNotes = nmid();
  export const kCmdMoveNotesToDirectory = nmid();
  export const kCmdSwitchToNotesInDir = nmid();
  export const kCmdSwitchToLocalStorage = nmid();
  export const kCmdExportNotes = nmid();
  export const kCmdEncryptNotes = nmid();
  export const kCmdDecryptNotes = nmid();
  export const kCmdEncryptionHelp = nmid();
  export const kCmdToggleSpellChecking = nmid();
  export const kCmdShowStorageHelp = nmid();
  export const kCmdSettings = nmid();
  export const kCmdOpenRecent = nmid();
  export const kCmdShowWelcomeNote = nmid();
  export const kCmdShowWelcomeDevNote = nmid();

  function buildMenuDef() {
    const menuNote = [
      ["Rename", kCmdRenameCurrentNote],
      ["Delete", kCmdDeleteCurrentNote],
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
      ["Run " + language + "\tAlt + Shift + R", kCmdRunBlock],
    ];

    let dh = getStorageFS();
    let currStorage = "Current store: browser (localStorage)";
    if (dh) {
      currStorage = `Current store: directory ${dh.name}`;
    }
    const menuStorage = [
      [currStorage, kMenuIdJustText],
      ["Move notes from browser to directory", kCmdMoveNotesToDirectory],
      ["Switch to browser (localStorage)", kCmdSwitchToLocalStorage],
      ["Switch to notes in a directory", kCmdSwitchToNotesInDir],
      kMenuSeparator,
      ["Export notes to .zip file", kCmdExportNotes],
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

    let spelling = (isSpellChecking ? "Disable" : "Enable") + " spell checking";

    const contextMenu = [
      ["Command Palette\tMod + Shift + P", kCmdCommandPalette],
      ["Open note\tMod + P", kCmdOpenNote],
      ["Create new note", kCmdCreateNewNote],
      ["Create new scratch note\tAlt + N", kCmdCreateScratchNote],
      ["This Note", menuNote],
      ["Block", menuBlock],
      ["Notes storage", menuStorage],
    ];
    if (dh) {
      // encryption only for files stored on disk
      contextMenu.push(["Encryption", menuEncrypt]);
    }
    contextMenu.push(
      [spelling, kCmdToggleSpellChecking],
      ["Settings", kCmdSettings],
      ["Help", menuHelp],
      ["Tip: Ctrl + click for browser's context menu", kMenuIdJustText],
    );

    return contextMenu;
  }

  /**
   * @param {import("../Menu.svelte").MenuItemDef} mi
   */
  function menuItemStatus(mi) {
    let s = mi[0];
    let mid = mi[1];
    if (mid === kMenuIdJustText) {
      return kMenuStatusDisabled;
    }
    // console.log("menuItemStatus:", mi);
    // console.log("s:", s, "mid:", mid);
    let lang = getLanguage(language);
    let dh = getStorageFS();
    // console.log("dh:", dh);
    let hasFS = supportsFileSystem();
    if (mid === kCmdFormatBlock) {
      if (!langSupportsFormat(lang)) {
        return kMenuStatusRemoved;
      }
    } else if (mid === kCmdRunBlock) {
      if (!langSupportsRun(lang)) {
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
    }
    return kMenuStatusNormal;
  }

  /**
   * @param {number} cmdId
   * @param ev
   */
  async function onmenucmd(cmdId) {
    // console.log("cmd:", cmdId);
    showingMenu = false;
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
      getEditor().addNewBlockAfterCurrent();
    } else if (cmdId === kCmdNewBlockBeforeCurrent) {
      getEditor().addNewBlockBeforeCurrent();
    } else if (cmdId === kCmdNewBlockAtEnd) {
      getEditor().addNewBlockAfterLast();
    } else if (cmdId === kCmdNewBlockAtStart) {
      getEditor().addNewBlockBeforeFirst();
    } else if (cmdId === kCmdSplitBlockAtCursor) {
      getEditor().insertNewBlockAtCursor();
    } else if (cmdId === kCmdGoToBlock) {
      openBlockSelector();
    } else if (cmdId === kCmdGoToNextBlock) {
      getEditor().gotoNextBlock();
    } else if (cmdId === kCmdGoToPreviousBlock) {
      getEditor().gotoPreviousBlock();
    } else if (cmdId === kCmdChangeBlockLanguage) {
      openLanguageSelector();
    } else if (cmdId === kCmdBlockSelectAll) {
      getEditor().selectAll();
    } else if (cmdId === kCmdFormatBlock) {
      getEditor().formatCurrentBlock();
    } else if (cmdId === kCmdRunBlock) {
      getEditor().runCurrentBlock();
    } else if (cmdId === kCmdToggleSpellChecking) {
      toggleSpellCheck();
    } else if (cmdId === kCmdShowHelp) {
      showHelp();
    } else if (cmdId === kCmdShowHelpAsNote) {
      showHelpAsNote();
    } else if (cmdId === kCmdShowReleaseNotes) {
      showReleaseNotes();
    } else if (cmdId == kCmdShowWelcomeNote) {
      showWelcomeNote();
    } else if (cmdId == kCmdShowWelcomeDevNote) {
      showWelcomeDevNote();
    } else if (cmdId === kCmdMoveNotesToDirectory) {
      storeNotesOnDisk();
    } else if (cmdId === kCmdSwitchToNotesInDir) {
      await pickAnotherDirectory2();
    } else if (cmdId === kCmdSwitchToLocalStorage) {
      await switchToBrowserStorage();
    } else if (cmdId === kCmdExportNotes) {
      exportNotesToZipFile();
    } else if (cmdId === kCmdShowStorageHelp) {
      showHelp("#storing-notes-on-disk");
    } else if (cmdId === kCmdSettings) {
      openSettings();
    } else if (cmdId === kCmdEncryptNotes) {
      openEncryptPassword();
    } else if (cmdId === kCmdDecryptNotes) {
      decryptAllNotes();
    } else if (cmdId === kCmdEncryptionHelp) {
      showHelp("#encryption");
    } else if (cmdId == kCmdOpenRecent) {
      openHistorySelector();
    } else {
      console.log("unknown menu cmd id");
    }
  }

  let contextMenuDef = $state(null);
  /**
   * @param {MouseEvent} ev
   */
  function oncontextmenu(ev) {
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
    openContextMenu(ev);
  }

  /**
   * @param {MouseEvent} ev
   * @param {{x: number, y: number}} pos
   */
  function openContextMenu(ev, pos = null) {
    console.log("openContextMenu:", ev);
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    contextMenuDef = buildMenuDef();
    contextMenuPos = pos || { x: ev.x, y: ev.y };
    showingMenu = true;
  }

  function closeMenu() {
    showingMenu = false;
    getEditor().focus();
  }

  let commandsDef = $state(null);

  const commandNameOverrides = [
    kCmdRenameCurrentNote,
    "Rename Current Note",
    kCmdDeleteCurrentNote,
    "Delete Current Note",
    kCmdShowStorageHelp,
    "Help: Storage",
  ];

  function commandNameOverride(id, name) {
    let n = len(commandNameOverrides);
    for (let i = 0; i < n; i += 2) {
      if (id == commandNameOverrides[i]) {
        return commandNameOverrides[i + 1];
      }
    }
    if (id >= kCmdBlockFirst && id <= kCmdBlockLast) {
      return "Block: " + name;
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

  const commandPaletteAdditions = [["Open Recent Note", kCmdOpenRecent]];
  function openCommandPalette() {
    console.log("openCommandPalette");
    commandsDef = buildCommandsDef();
    commandsDef.push(...commandPaletteAdditions);
    showingCommandPalette = true;
  }

  function closeCommandPalette() {
    showingCommandPalette = false;
    getEditor().focus();
  }

  async function executeCommand(cmdId) {
    showingCommandPalette = false;
    // closeCommandPalette();
    onmenucmd(cmdId);
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
      addToast(
        "Press Ctrl + right mouse click for context menu when spell checking is enabled",
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

  function closeRename() {
    showingRenameNote = false;
    getEditor().focus();
  }

  function closeSettings() {
    console.log("closeSettings");
    showingSettings = false;
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
    getEditor().focus();
  }

  function closeHistorySelector() {
    showingHistorySelector = false;
    getEditor().focus();
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

  async function openNote(name, skipSave = false) {
    console.log("App.openNote:", name);
    let editor = getEditor();
    editor.setReadOnly(true);
    let msg = `Loading <span class="font-bold">${name}</span>...`;
    showModalMessageHTML(msg, 300);
    await editor.openNote(name, skipSave);
    // await sleep(400);
    clearModalMessage();
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
    showingCreateNewNote = false;
    await createNoteWithName(name);
    openNote(name);
    // TODO: add a way to undo creation of the note
    addToast(`Created note '${name}'`);
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
    addToast(`Deleted note '${name}'`);
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

  function showWelcomeNote() {
    openNote(kWelcomeSystemNoteName);
  }

  function showWelcomeDevNote() {
    openNote(kWelcomeDevSystemNoteName);
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
  <TopNav {noteName} shortcut={noteShortcut} />
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
    shortcut={noteShortcut}
    {noteName}
    {line}
    {column}
    {docSize}
    {selectionSize}
    {language}
    {languageAuto}
    {isSpellChecking}
    {formatCurrentBlock}
    {runCurrentBlock}
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
      items={blockItems}
      {selectBlock}
      initialSelection={initialBlockSelection}
    ></BlockSelector>
  </Overlay>
{/if}

{#if showingNoteSelector}
  <Overlay onclose={closeNoteSelector} blur={true}>
    <NoteSelector
      {switchToCommandPalette}
      openNote={onOpenNote}
      createNote={onCreateNote}
      deleteNote={onDeleteNote}
    />
  </Overlay>
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
