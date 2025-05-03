import {
  blobFromUint8Array,
  fsDeleteFile,
  fsFileHandleReadTextFile,
  fsFileHandleWriteText,
  fsReadBinaryFile,
  fsReadTextFile,
  fsRenameFile,
  fsWriteBlob,
  fsWriteTextFile,
  openDirPicker,
  readDir,
} from "./fileutil";
import {
  clearModalMessage,
  showModalMessageHTML,
} from "./components/ModalMessage.svelte";
import { decryptBlobAsString, encryptStringAsBlob, hash } from "kiss-crypto";
import {
  formatDateYYYYMMDDDay,
  len,
  removeDuplicates,
  throwIf,
  trimSuffix,
} from "./util";
import { fromFileName, isValidFileName, toFileName } from "./filenamify";
import {
  getBuiltInFunctionsNote,
  getHelp,
  getInboxNote,
  getJournalNote,
  getReleaseNotes,
  getWelcomeNote,
  getWelcomeNoteDev,
} from "./system-notes";
import { getSettings, loadSettings, saveSettings } from "./settings";
import {
  getStats,
  incNoteCreateCount,
  incNoteDeleteCount,
  incNoteSaveCount,
} from "./state";
import { historyPush, removeNoteFromHistory, renameInHistory } from "./history";

import { KV } from "./dbutil";
import { dirtyState } from "./state.svelte";
import { getPasswordFromUser, requestFileWritePermission } from "./globals";
import {
  kMetadataName,
  loadNotesMetadata,
  reassignNoteShortcut,
  removeNoteFromMetadata,
  renameNoteInMetadata,
} from "./metadata";
import { tick } from "svelte";

// is set if we store notes on disk, null if in localStorage
/** @type {FileSystemDirectoryHandle | null} */
let storageFS = null;

/**
 * if we're storing notes on disk, returns dir handle
 * returns null if we're storing in localStorage
 * @returns {FileSystemDirectoryHandle | null}
 */
export function getStorageFS() {
  // console.log("getStorageFS:", storageFS);
  return storageFS;
}

/**
 * @param {FileSystemDirectoryHandle} dh
 */
export function setStorageFS(dh) {
  console.log("setStorageFS:", dh);
  storageFS = dh;
}

// some things, like FilesystemDirectoryHandle, we need to store in indexedDb
const db = new KV("edna", "keyval");

const kStorageDirHandleKey = "storageDirHandle";

const kLSPassowrdKey = "edna-password";

/**
 * @param {string} pwd
 */
function rememberPassword(pwd) {
  localStorage.setItem(kLSPassowrdKey, pwd);
}

function removePassword() {
  localStorage.removeItem(kLSPassowrdKey);
}

/**
 * @returns {string}
 */
function getPasswordHash() {
  let pwd = localStorage.getItem(kLSPassowrdKey);
  if (!pwd) {
    return null;
  }
  let pwdHash = saltPassword(pwd);
  return pwdHash;
}

/**
 * @param {string} msg
 * @returns {Promise<string>}
 */
async function getPasswordHashMust(msg) {
  let pwdHash = getPasswordHash();
  let simulateNoPassword = false;
  if (simulateNoPassword) {
    pwdHash = null;
  }
  if (pwdHash) {
    return pwdHash;
  }
  let pwd = await getPasswordFromUser(msg);
  // TODO: we don't know yet if password is correct, maybe move this somewhere else
  rememberPassword(pwd);
  return saltPassword(pwd);
}

/**
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function dbGetDirHandle() {
  let dh = await db.get(kStorageDirHandleKey);
  setStorageFS(dh ? dh : null);
  return storageFS;
}

/**
 * @param {FileSystemDirectoryHandle} dh
 */
export async function dbSetDirHandle(dh) {
  await db.set(kStorageDirHandleKey, dh);
  storageFS = dh;
}

export async function dbDelDirHandle() {
  await db.del(kStorageDirHandleKey);
  storageFS = null;
}

export const kEdnaFileExt = ".edna.txt";
const kEdnaEncrFileExt = ".encr.edna.txt";

function isEncryptedEdnaFile(fileName) {
  return fileName.endsWith(kEdnaEncrFileExt);
}
/**
 * @param {string} fileName
 * @returns {boolean}
 */
function isEdnaFile(fileName) {
  return fileName.endsWith(kEdnaFileExt);
}

/**
 * @param {string} name
 * @returns {string}
 */
function trimEdnaExt(name) {
  let s = trimSuffix(name, kEdnaEncrFileExt);
  s = trimSuffix(s, kEdnaFileExt);
  throwIf(s === name); // assumes we chacked before calling
  return s;
}

/**
 * @param {string} name
 * @param {boolean} [isEncr]
 * @returns {string}
 */
export function notePathFromNameFS(name, isEncr = undefined) {
  if (isEncr === undefined) {
    isEncr = isEncryptedNote(name);
  }
  let ext = isEncr ? kEdnaEncrFileExt : kEdnaFileExt;
  name = toFileName(name + ext); // note: must happen after isEncryptedNote() check
  return name;
}

const kLSKeyPrefix = "note:";
// TODO: we're not encrypting notes in local storage. maybe we never will
const kLSKeyEncrPrefix = "note.encr:";

function notePathFromNameLS(name) {
  let isEncr = isEncryptedNote(name);
  if (isEncr) {
    return kLSKeyEncrPrefix + name;
  }
  return kLSKeyPrefix + name;
}

export function notePathFromName(name) {
  let dh = getStorageFS();
  if (dh) {
    return notePathFromNameFS(name);
  } else {
    return notePathFromNameLS(name);
  }
}

export const kScratchNoteName = "scratch";
export const kDailyJournalNoteName = "daily journal";
export const kInboxNoteName = "inbox";
export const kMyFunctionsNoteName = "edna: my functions";

export const kHelpSystemNoteName = "system:help";
export const kReleaseNotesSystemNoteName = "system:Release Notes";
export const kWelcomeSystemNoteName = "system:welcome";
export const kWelcomeDevSystemNoteName = "system:welcome dev";
export const kBuiltInFunctionsNoteName = "system:built in functions";

const systemNotes = [
  kHelpSystemNoteName,
  kReleaseNotesSystemNoteName,
  kWelcomeSystemNoteName,
  kWelcomeDevSystemNoteName,
  kBuiltInFunctionsNoteName,
];

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isSystemNoteName(name) {
  return systemNotes.includes(name);
}

export const blockHdrPlainText = "\n∞∞∞text-a\n";
export const blockHdrMarkdown = "\n∞∞∞markdown\n";
export const blockHdrJSON = "\n∞∞∞json\n";
export const blockHdrPHP = "\n∞∞∞php\n";

/**
 * @param {string} name
 * @param {string} content
 * @returns {Promise<number>}
 */
export async function createIfNotExists(name, content, existingNotes) {
  if (!existingNotes) {
    existingNotes = getLatestNoteNames();
  }
  if (existingNotes.includes(name)) {
    console.log(`note ${name} already exists`);
    return 0;
  }
  await createNoteWithName(name, content);
  return 1;
}

/**
 * @param {string[]} existingNotes
 * @returns {Promise<number>}
 */
export async function createDefaultNotes(existingNotes) {
  let isFirstRun = getStats().appOpenCount < 2;
  console.log(
    `isFirstRun: ${isFirstRun}, len(existingNotes): ${len(existingNotes)}`,
  );
  if (len(existingNotes) == 0) {
    // scenario: moved notes to disk and switched back to local storage
    isFirstRun = true;
  }

  let welcomeNote = getWelcomeNote();

  let nCreated = await createIfNotExists(
    kScratchNoteName,
    welcomeNote,
    existingNotes,
  );
  // scratch note must always exist but the user can delete inbox / daily journal notes
  if (isFirstRun) {
    let inbox = getInboxNote();
    nCreated += await createIfNotExists(kInboxNoteName, inbox, existingNotes);
    // re-create those notes if the user hasn't deleted them
    let journal = getJournalNote();
    nCreated += await createIfNotExists(
      kDailyJournalNoteName,
      journal,
      existingNotes,
    );
  }
  if (nCreated > 0) {
    await loadNoteNames();
  }
  if (isFirstRun) {
    await loadNotesMetadata(); // must pre-load to make them available
    reassignNoteShortcut(kScratchNoteName, "1");
    reassignNoteShortcut(kDailyJournalNoteName, "2");
    reassignNoteShortcut(kInboxNoteName, "3");
  }
  return nCreated;
}

/**
 * @returns {string[]}
 */
function getLSKeys() {
  let nKeys = localStorage.length;
  let keys = [];
  for (let i = 0; i < nKeys; i++) {
    const key = localStorage.key(i);
    keys.push(key);
  }
  return keys;
}

export function debugRemoveLocalStorageNotes() {
  let keys = getLSKeys();
  for (let key of keys) {
    let isEncr = key.startsWith(kLSKeyEncrPrefix);
    let isRegular = key.startsWith(kLSKeyPrefix);
    if (isEncr || isRegular) {
      localStorage.removeItem(key);
      console.log(`removed ${key}`);
    }
  }
  localStorage.removeItem(kMetadataName);
}

/**
 * @returns {string[][]}
 */
function loadNoteNamesLS() {
  /**
   * @param {string} notePath
   * @returns {string}
   */
  function getNoteNameLS(notePath) {
    const i = notePath.indexOf(":");
    return notePath.substring(i + 1);
  }

  let allNotes = [];
  let encryptedNotes = [];
  let keys = getLSKeys();
  for (let key of keys) {
    let isEncr = key.startsWith(kLSKeyEncrPrefix);
    let isRegular = key.startsWith(kLSKeyPrefix);
    if (isEncr || isRegular) {
      let name = getNoteNameLS(key);
      allNotes.push(name);
      if (isEncr) {
        encryptedNotes.push(name);
      }
    }
  }
  return [allNotes, encryptedNotes];
}

// we must cache those because loadNoteNames() is async and we can't always call it
// note: there's a potential of getting out of sync
/** @type {string[]} */
let latestNoteNames = [];
/** @type {string[]} */
let encryptedNoteNames = [];

/** @typedef {{
  handle: FileSystemFileHandle,
  fileName: string,
  noteName: string,
}} OpenedNote */

// list of notes opened from disk. They are not part of the workspace, will be forgotten
// on app reload. Their names are their full fileNames which helps to ensure that
// their names don't conflict with notes in the workspace
// TODO: maybe add some unique prefix to the name (like `system:` for system notes?)
/** @type {OpenedNote[]} */
let openedNotes = [];

/**
 *
 * @param {string} noteName
 * @returns {OpenedNote}
 */
function getOpenedNote(noteName) {
  for (let i of openedNotes) {
    if (i.noteName === noteName) {
      return i;
    }
  }
  return null;
}

/**
 * @param {string} noteName
 */
export function unrememberOpenedNote(noteName) {
  openedNotes = openedNotes.filter(
    (openedNote) => openedNote.noteName !== noteName,
  );
  latestNoteNames = latestNoteNames.filter((name) => name != noteName);
}

/**
 * @param {FileSystemFileHandle} fh
 * @returns string
 */
export function rememberOpenedNote(fh) {
  if (fh.name.endsWith(kEdnaEncrFileExt)) {
    // we don't support encrypted notes
    return null;
  }
  let noteName = noteNameFromFileNameFS(fh.name);
  if (!noteName) {
    return null;
  }

  // ensure name is unique
  // TODO: should clear when switching workspaces because the uniqueness
  // will no longer be guaranteed
  // note: could solve that by using unique IDs for files and returning
  // NoteInfo[] that contains info about note, including id and using
  // ids to identify notes
  let baseNoteName = noteName;
  let n = 1;
  while (latestNoteNames.includes(noteName)) {
    noteName = baseNoteName + `-${n}`;
    n++;
  }
  let opened = {
    handle: fh,
    fileName: fh.name,
    noteName: noteName,
  };
  openedNotes.push(opened);
  latestNoteNames.push(noteName);
  return noteName;
}

/**
 * returns null if not a valid name
 * @param {string} fileName
 * @returns {string}
 */
export function noteNameFromFileNameFS(fileName) {
  // throwIf(!isValidFileName(fileName));
  if (!isValidFileName) {
    return null;
  }
  let encodedName = trimEdnaExt(fileName);
  let name = fromFileName(encodedName);
  return name;
}

/**
 * we might have non-escaped file names if:
 * - those are notes created before our escaping scheme
 * - user renmaed the note on disk
 * @param {FileSystemDirectoryHandle} dh
 * @returns {Promise<void>}
 */
export async function ensureValidNoteNamesFS(dh) {
  let fsEntries = await readDir(dh);
  for (let e of fsEntries.dirEntries) {
    if (e.isDir) {
      continue;
    }
    let oldName = e.name;
    if (!isEdnaFile(oldName)) {
      continue;
    }
    if (isValidFileName(oldName)) {
      continue;
    }
    let newName = toFileName(oldName);
    // note: if newName already exists, it'll be over-written
    fsRenameFile(dh, newName, oldName);
    console.log(`renamed '${oldName}' => '${newName}`);
  }
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {(fileName, noteName, isEncr) => Promise<void>} fn
 */
export async function forEachNoteFileFS(dh, fn) {
  let fsEntries = await readDir(dh);
  // console.log("files", fsEntries);
  for (let e of fsEntries.dirEntries) {
    if (e.isDir) {
      continue;
    }
    let fileName = e.name;
    if (!isEdnaFile(fileName)) {
      continue;
    }
    if (!isValidFileName(fileName)) {
      continue;
    }
    let name = noteNameFromFileNameFS(fileName);
    // filter out empty names, can be created maliciously or due to a bug
    if (name === null || name === "") {
      continue;
    }
    let isEncr = fileName.endsWith(kEdnaEncrFileExt);
    await fn(fileName, name, isEncr);
  }
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @returns {Promise<string[][]>}
 */
async function loadNoteNamesFS(dh) {
  /** @type {string[]} */
  let all = [];
  /** @type {string[]} */
  let encrypted = [];
  await forEachNoteFileFS(dh, async (fileName, name, isEncr) => {
    // console.log("loadNoteNamesFS:", fileName);
    all.push(name);
    if (isEncr) {
      encrypted.push(name);
    }
  });
  // console.log("loadNoteNamesFS() res:", res);
  return [all, encrypted];
}

/**
 * after creating / deleting / renaming a note we need to update
 * cached latestNoteNames
 * @returns {Promise<string[]>}
 */
export async function loadNoteNames() {
  console.log("loadNoteNames");
  let dh = getStorageFS();
  /** @type {string[][]} */
  let res = [];
  if (!dh) {
    res = loadNoteNamesLS();
  } else {
    res = await loadNoteNamesFS(dh);
  }

  // TODO: got a case where I had both foo.edna.txt and foo.encr.edna.txt which caused
  // duplicate names which cased note selector to fail due to duplicate key
  // don't quite know how this happened but it could be done maliciously
  latestNoteNames = removeDuplicates(res[0]);
  encryptedNoteNames = removeDuplicates(res[1]);
  // console.log("loadNoteNames() res:", res);
  return latestNoteNames;
}

export function getLatestNoteNames() {
  return latestNoteNames;
}

export function startsWithBlockHeader(s) {
  return s.startsWith("\n∞∞∞");
}

// in case somehow a note doesn't start with the block header, fix it up
export function fixUpNoteContent(s) {
  // console.log("fixUpNote:", content)
  if (s === null) {
    // console.log("fixUpNote: null content")
    return blockHdrMarkdown;
  }
  if (!s.startsWith("\n∞∞∞")) {
    // console.log("fixUpNote: added header to content", s.substring(0, 80));
    s = blockHdrMarkdown + s;
  }
  return s;
}

/**
 * @param {string} name
 * @returns {string}
 */
function getSystemNoteContent(name) {
  console.log("getSystemNoteContent:", name);
  let s = "";
  switch (name) {
    case kHelpSystemNoteName:
      s = getHelp();
      break;
    case kReleaseNotesSystemNoteName:
      s = getReleaseNotes();
      break;
    case kWelcomeSystemNoteName:
      s = getWelcomeNote();
      break;
    case kWelcomeDevSystemNoteName:
      s = getWelcomeNoteDev();
      break;
    case kBuiltInFunctionsNoteName:
      s = getBuiltInFunctionsNote();
      break;
    default:
      throw new Error("unknown system note:" + name);
  }
  return s;
}

/**
 * @param {string} base
 * @param {string[]} existingNames
 * @returns {string}
 */
function pickUniqueName(base, existingNames) {
  let name = base;
  let i = 1;
  while (existingNames.includes(name)) {
    name = base + "-" + i;
    i++;
  }
  return name;
}

/**
 * @param {string} content
 * @returns {Promise<void>}
 */
export async function saveCurrentNote(content) {
  let settings = getSettings();
  let name = settings.currentNoteName;
  console.log("note name:", name);
  if (isSystemNoteName(name)) {
    console.log("skipped saving system note", name);
    return;
  }
  let openedNote = getOpenedNote(name);
  if (openedNote) {
    let fh = openedNote.handle;
    let ok = await requestFileWritePermission(fh);
    if (!ok) {
      return;
    }
    console.log("saveCurrentNote: ok:", ok);
    await fsFileHandleWriteText(fh, content);
    dirtyState.isDirty = false;
    incNoteSaveCount();
    return;
  }

  let dh = getStorageFS();
  if (!dh) {
    let path = notePathFromNameLS(name);
    localStorage.setItem(path, content);
  } else {
    await writeMaybeEncryptedFS(dh, name, content);
  }
  dirtyState.isDirty = false;
  incNoteSaveCount();
}

/**
 * @param {string} name
 * @param {string} content
 * @returns {Promise<void>}
 */
export async function createNoteWithName(name, content = null) {
  let dh = getStorageFS();
  content = fixUpNoteContent(content);
  if (!dh) {
    const path = notePathFromName(name);
    // TODO: should it happen that note already exists?
    if (localStorage.getItem(path) == null) {
      localStorage.setItem(path, content);
      console.log("created note", name);
      incNoteCreateCount();
    } else {
      console.log("note already exists", name);
    }
    await loadNoteNames();
    return;
  }

  // TODO: check if exists
  await writeNoteFS(dh, name, content);
  incNoteCreateCount();
  await loadNoteNames();
}

/*
 * @param {string} name
 * @param {string} content
 * @returns {Promise<void>}
 */
export async function appendToNote(name, content) {
  throwIf(
    !startsWithBlockHeader(content),
    "content must start with block header ~~~",
  );

  let dh = getStorageFS();
  if (!dh) {
    let path = notePathFromName(name);
    let v = localStorage.getItem(path);
    if (v === null) {
      console.log("created new ls note", name, path);
      incNoteCreateCount();
    } else {
      console.log("appended to existing ls note", name, path);
      incNoteSaveCount();
    }
    let newContent = (v || "") + content;
    localStorage.setItem(path, newContent);
    return;
  }

  let newContent = content;
  if (noteExists(name)) {
    let oldContent = await loadNote(name);
    newContent = content + oldContent;
    incNoteSaveCount();
  } else {
    incNoteCreateCount();
  }
  await writeMaybeEncryptedFS(dh, name, newContent);
}

/**
 * creates a new scratch-${N} note
 * @returns {Promise<string>}
 */
export async function createNewScratchNote() {
  let noteNames = await loadNoteNames();
  // generate a unique "scratch-${N}" note name
  let scratchName = pickUniqueName("scratch", noteNames);
  await createNoteWithName(scratchName);
  return scratchName;
}

/**
 * @param {string} name
 * @param {string} content
 * @returns {string}
 */
function autoCreateDayInJournal(name, content) {
  if (name != kDailyJournalNoteName) {
    return content;
  }
  // create block for a current day
  const dt = formatDateYYYYMMDDDay();
  if (content === null) {
    content = blockHdrMarkdown + "# " + dt + "\n";
  } else {
    if (!content.includes(dt)) {
      content = blockHdrMarkdown + "# " + dt + "\n" + content;
    }
  }
  return content;
}

function isEncryptedNote(name) {
  let res = encryptedNoteNames.includes(name);
  return res;
}

/**
 * @param {string} name
 * @returns {string}
 */
function loadNoteLS(name) {
  let key = kLSKeyPrefix + name;
  if (isEncryptedNote(name)) {
    key = kLSKeyEncrPrefix + name;
  }
  return localStorage.getItem(key);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function noteExists(name) {
  let notes = getLatestNoteNames();
  return notes.includes(name) || isSystemNoteName(name);
}

/**
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function loadNoteIfExists(name) {
  if (!noteExists(name)) {
    return null;
  }
  return await loadNote(name);
}

/**
 * returns null if can't read the note
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function loadNote(name) {
  console.log("loadNote:", name);
  let res;
  if (isSystemNoteName(name)) {
    res = getSystemNoteContent(name);
  } else {
    let openedNote = getOpenedNote(name);
    if (openedNote) {
      res = await fsFileHandleReadTextFile(openedNote.handle);
    } else {
      let dh = getStorageFS();
      if (!dh) {
        res = loadNoteLS(name);
      } else {
        res = await readMaybeEncryptedNoteFS(dh, name);
      }
    }
  }
  if (res === null) {
    return null;
  }
  historyPush(name);
  // TODO: this should happen in App.vue:onDocChange(); this was easier to write
  res = autoCreateDayInJournal(name, res);
  return fixUpNoteContent(res);
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} name
 * @returns {Promise<string>}
 */
async function readMaybeEncryptedNoteFS(dh, name) {
  let path = notePathFromNameFS(name);
  if (!isEncryptedEdnaFile(path)) {
    let res = await fsReadTextFile(dh, path);
    return res;
  }
  let res = await readEncryptedFS(dh, path);
  return res;
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 * @returns {Promise<string>}
 */
async function readEncryptedFS(dh, fileName) {
  let msg = "";
  while (true) {
    let pwdHash = await getPasswordHashMust(msg);
    let d = await fsReadBinaryFile(dh, fileName);
    let s = null;
    try {
      s = decryptBlobAsString({ key: pwdHash, cipherblob: d });
    } catch (e) {
      console.log(e);
      s = null;
    }
    if (s !== null) {
      return s;
    }
    let pwd = localStorage.getItem(kLSPassowrdKey);
    if (!pwd) {
      msg = "Please enter password to decrypt files";
    } else {
      msg = `Password '${pwd}' is not correct. Please enter valid password.`;
    }
    // password was likely incorrect so remove it so that getPasswordHashMust()
    // asks the user
    removePassword();
  }
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} name
 * @param {string} content
 * @returns {Promise<void>}
 */
async function writeMaybeEncryptedFS(dh, name, content) {
  let path = notePathFromNameFS(name);
  if (!isEncryptedNote(name)) {
    await fsWriteTextFile(dh, path, content);
    return;
  }
  let pwdHash = await getPasswordHashMust("");
  throwIf(!pwdHash, "needs password");
  await writeEncryptedFS(dh, pwdHash, path, content);
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} pwdHash
 * @param {string} fileName
 * @param {string} s
 * @returns {Promise<void>}
 */
async function writeEncryptedFS(dh, pwdHash, fileName, s) {
  let d = encryptStringAsBlob({ key: pwdHash, plaintext: s });
  let blob = blobFromUint8Array(d);
  await fsWriteBlob(dh, fileName, blob);
}

/**
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} name
 * @param {string} content
 */
export async function writeNoteFS(dh, name, content) {
  let isEncr = isUsingEncryption();
  const path = notePathFromNameFS(name, isEncr);
  if (!isEncr) {
    await fsWriteTextFile(dh, path, content);
    return;
  }
  let pwdHash = await getPasswordHashMust("");
  await writeEncryptedFS(dh, pwdHash, path, content);
}

/**
 * @returns {Promise<string>}
 */
export async function loadCurrentNote() {
  let settings = getSettings();
  return loadNote(settings.currentNoteName);
}

/**
 * @returns {Promise<string>}
 */
export async function loadCurrentNoteIfOnDisk() {
  let settings = getSettings();
  let name = settings.currentNoteName;
  if (isSystemNoteName(name)) {
    return null;
  }
  let openedNote = getOpenedNote(name);
  if (openedNote) {
    return null;
  }
  let dh = getStorageFS();
  if (!dh) {
    return null;
  }
  return await readMaybeEncryptedNoteFS(dh, name);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function canDeleteNote(name) {
  if (name === kScratchNoteName) {
    return false;
  }
  let openedNote = getOpenedNote(name);
  if (openedNote) {
    return false;
  }
  return !isSystemNoteName(name);
}

/* I've seen loadNoteNames() fail. I assume that's because of doing directory read
right after deleting a file, so retry it after a tick */
async function loadNoteNamesMoreRobust() {
  try {
    await loadNoteNames();
  } catch (e) {
    console.error("loadNoteNames", e);
    tick().then(() => {
      loadNoteNames()
        .then(() => {
          console.log("loadNoteNames retry succeeded");
        })
        .catch((e) => {
          console.error("loadNoteNames", e);
        });
    });
  }
}

/**
 * @param {string} name
 */
export async function deleteNote(name) {
  let dh = getStorageFS();
  if (!dh) {
    let key = notePathFromName(name);
    localStorage.removeItem(key);
  } else {
    let fileName = notePathFromNameFS(name);
    await fsDeleteFile(dh, fileName);
  }
  incNoteDeleteCount();
  removeNoteFromHistory(name);
  await removeNoteFromMetadata(name);
  await loadNoteNamesMoreRobust();
}

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {string} content
 */
export async function renameNote(oldName, newName, content) {
  await createNoteWithName(newName, content);
  // update metadata and history before deleteNote() because it'll
  // remove from history and metadata
  await renameNoteInMetadata(oldName, newName);
  renameInHistory(oldName, newName);
  await deleteNote(oldName);
}

/**
 * @param {string} noteName
 * @param {string[]} diskNoteNames
 * @param {FileSystemDirectoryHandle} dh
 */
async function migrateNote(noteName, diskNoteNames, dh) {
  let name = noteName;
  /** @type {string} */
  let noteInfoOnDisk;
  for (let ni of diskNoteNames) {
    if (ni === name) {
      noteInfoOnDisk = ni;
      break;
    }
  }
  let content = loadNoteLS(noteName);
  if (!noteInfoOnDisk) {
    // didn't find a note with the same name so create
    let fileName = notePathFromNameFS(name);
    await fsWriteTextFile(dh, fileName, content);
    console.log(
      "migrateNote: created new note",
      fileName,
      "from note with name",
      name,
    );
    return;
  }
  let path = notePathFromNameFS(name);
  let diskContent = await fsReadTextFile(dh, path);
  if (content === diskContent) {
    console.log("migrateNote: same content, skipping", noteName);
    return;
  }
  // if the content is different, create a new note with a different name
  let newName = pickUniqueName(name, diskNoteNames);
  let fileName = notePathFromName(newName);
  await fsWriteTextFile(dh, fileName, content);
  console.log(
    "migrateNote: created new note",
    fileName,
    "because of different content with",
    name,
  );
}

// when notes are stored on disk, they can be stored on replicated online
// storage like OneDrive
// just in case we pre-load them to force downloading them to local drive
// to make future access faster
/**
 * @returns {Promise<number>}
 */
export async function preLoadAllNotes() {
  let dh = getStorageFS();
  if (dh === null) {
    return;
  }
  let n = 0;
  forEachNoteFileFS(dh, async (fileName, noteName, isEncr) => {
    n++;
    // no need to await, the read can happen whenever
    fsReadBinaryFile(dh, fileName);
  });
  return n;
}

/**
 * @param {string} lsKeyName
 * @param {FileSystemDirectoryHandle} dh
 * @param {string} fileName
 */
async function moveLSToFS(lsKeyName, dh, fileName) {
  console.log("moveLSToFS:", lsKeyName, fileName, dh.name);
  let s = localStorage.getItem(lsKeyName);
  if (s === null) {
    return;
  }
  await fsWriteTextFile(dh, fileName, s);
  localStorage.removeItem(lsKeyName);
}

/**
 * @param {FileSystemDirectoryHandle} dh
 */
export async function switchToStoringNotesOnDisk(dh) {
  console.log("switchToStoringNotesOnDisk");
  let res = await loadNoteNamesFS(dh);
  let diskNoteNames = res[0];

  // migrate notes
  for (let name of latestNoteNames) {
    if (isSystemNoteName(name)) {
      continue;
    }
    let openedNote = getOpenedNote(name);
    if (openedNote) {
      continue;
    }
    migrateNote(name, diskNoteNames, dh);
  }
  // remove migrated notes
  for (let name of latestNoteNames) {
    if (isSystemNoteName(name)) {
      continue;
    }
    let openedNote = getOpenedNote(name);
    if (openedNote) {
      continue;
    }
    let key = notePathFromNameLS(name);
    localStorage.removeItem(key);
  }

  await moveLSToFS(kMetadataName, dh, kMetadataName);

  storageFS = dh;
  // save in indexedDb so that it persists across sessions
  await dbSetDirHandle(dh);
  let noteNames = await loadNoteNames();
  openedNotes = []; // can't guarantee names will be unique

  // migrate settings, update currentNoteName
  let settings = loadSettings();
  let name = settings.currentNoteName;
  if (!noteNames.includes(name)) {
    settings.currentNoteName = kScratchNoteName;
    saveSettings(settings);
  }
  return noteNames;
}

/**
 * @returns {Promise<boolean>}
 */
export async function pickAnotherDirectory() {
  try {
    let newDh = await openDirPicker(true);
    if (!newDh) {
      return false;
    }
    await dbSetDirHandle(newDh);
    openedNotes = []; // can't guarantee names will be unique
    return true;
  } catch (e) {
    console.error("pickAnotherDirectory", e);
  }
  return false;
}

/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeNoteName(name) {
  let res = name.trim();
  return res;
}

/**
 * @returns {number}
 */
export function getNotesCount() {
  return len(latestNoteNames);
}

/**
 * @returns {boolean}
 */
export function isUsingEncryption() {
  let dh = getStorageFS();
  if (!dh) {
    // no encryption for local storage
    return false;
  }
  let pwdHash = getPasswordHash();
  if (pwdHash) {
    return true;
  }
  return len(encryptedNoteNames) > 0;
}

// salt for hashing the password. not sure if it helps security wise
// but it's the best we can do. We can't generate unique salts for
// each password
const kEdnaSalt = "dbd71826401a4fca6c360f065a281063";

async function encryptNoteFS(dh, oldFileName, pwdHash) {
  if (isEncryptedEdnaFile(oldFileName)) {
    console.log("encryptNoteFS:", oldFileName, "already encrypted");
    return;
  }
  console.log("encryptNoteFS:", oldFileName);
  let s = await fsReadTextFile(dh, oldFileName);
  let newFileName = trimSuffix(oldFileName, kEdnaFileExt);
  newFileName += kEdnaEncrFileExt;
  await writeEncryptedFS(dh, pwdHash, newFileName, s);
  await dh.removeEntry(oldFileName);
}

async function decryptNoteFS(dh, oldFileName) {
  if (!isEncryptedEdnaFile(oldFileName)) {
    console.log("encryptNoteFS:", oldFileName, "already decrypted");
    return;
  }
  console.log("decryptNoteFS:", oldFileName);
  let s = await readEncryptedFS(dh, oldFileName);
  let newFileName = trimSuffix(oldFileName, kEdnaEncrFileExt);
  newFileName += kEdnaFileExt;
  await fsWriteTextFile(dh, newFileName, s);
  await dh.removeEntry(oldFileName);
}

/**
 * @param {string} pwd
 * @returns {string}
 */
function saltPassword(pwd) {
  let pwdHash = hash({ key: pwd, salt: kEdnaSalt });
  return pwdHash;
}

/**
 * @param {string} pwd
 */
export async function encryptAllNotes(pwd) {
  let dh = getStorageFS();
  throwIf(!db, "no encryption for local storage notes");

  rememberPassword(pwd);

  let pwdHash = saltPassword(pwd);
  await forEachNoteFileFS(dh, async (fileName, name, isEncr) => {
    if (isEncr) {
      return;
    }
    let msg = `Encrypting <b>${name}</b>`;
    showModalMessageHTML(msg, 0);
    await encryptNoteFS(dh, fileName, pwdHash);
  });
  clearModalMessage();

  await loadNoteNames();
}

export async function decryptAllNotes() {
  let dh = getStorageFS();
  throwIf(!db, "no decryption for local storage notes");

  await forEachNoteFileFS(dh, async (fileName, name, isEncr) => {
    if (!isEncr) {
      return;
    }
    let msg = `Decrypting <b>${name}</b>`;
    showModalMessageHTML(msg, 0);
    await decryptNoteFS(dh, fileName);
  });
  clearModalMessage();

  removePassword();
  await loadNoteNames();
}
