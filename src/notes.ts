import { tick } from "svelte";
import { decryptBlobAsString, encryptStringAsBlob, hash } from "kiss-crypto";
import { appState } from "./appstate.svelte";
import { clearModalMessage, showModalMessageHTML } from "./components/ModalMessage.svelte";
import { KV } from "./dbutil";
import { fromFileName, isValidFileName, toFileName } from "./filenamify";
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
import { getPasswordFromUser, requestFileWritePermission } from "./globals";
import { removeNoteFromHistory, renameNoteInHistory } from "./history.js";
import {
  kMetadataName,
  loadNotesMetadata,
  reassignNoteShortcut,
  removeNoteFromMetadata,
  renameNoteInMetadata,
} from "./metadata";
import { getSettings } from "./settings.svelte";
import { getStats, incNoteCreateCount, incNoteDeleteCount, incNoteSaveCount } from "./state";
import {
  getBuiltInFunctionsNote,
  getHelp,
  getInboxNote,
  getJournalNote,
  getReleaseNotes,
  getWelcomeNote,
  getWelcomeNoteDev,
} from "./system-notes";
import { formatDateYYYYMMDDDay, len, removeDuplicates, throwIf, trimSuffix } from "./util";

// is set if we store notes on disk, null if in localStorage
let storageFS: FileSystemDirectoryHandle | undefined;

export function getStorageFS(): FileSystemDirectoryHandle | undefined {
  // console.log("getStorageFS:", storageFS);
  return storageFS;
}

export function setStorageFS(dh: FileSystemDirectoryHandle | undefined) {
  // console.log("setStorageFS:", dh);
  storageFS = dh;
}

export function clearStorageFS() {
  storageFS = undefined;
}

// some things, like FilesystemDirectoryHandle, we need to store in indexedDb
const db = new KV("edna", "keyval");

const kStorageDirHandleKey = "storageDirHandle";

const kLSPassowrdKey = "edna-password";

function rememberPassword(pwd: string) {
  localStorage.setItem(kLSPassowrdKey, pwd);
}

function removePassword() {
  localStorage.removeItem(kLSPassowrdKey);
}

function getPasswordHash(): string | undefined {
  let pwd = localStorage.getItem(kLSPassowrdKey);
  if (!pwd) {
    return;
  }
  let pwdHash = saltPassword(pwd);
  return pwdHash;
}

async function getPasswordHashMust(msg: string): Promise<string> {
  let pwdHash = getPasswordHash();
  let simulateNoPassword = false;
  if (simulateNoPassword) {
    pwdHash = undefined;
  }
  if (pwdHash) {
    return pwdHash;
  }
  let pwd = await getPasswordFromUser(msg);
  // TODO: we don't know yet if password is correct, maybe move this somewhere else
  rememberPassword(pwd);
  return saltPassword(pwd);
}

export async function dbGetDirHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  let dh = await db.get(kStorageDirHandleKey);
  if (!dh) return;
  setStorageFS(dh);
  return storageFS;
}

export async function dbSetDirHandle(dh: FileSystemDirectoryHandle) {
  await db.set(kStorageDirHandleKey, dh);
  storageFS = dh;
}

export async function dbDelDirHandle() {
  await db.del(kStorageDirHandleKey);
  storageFS = undefined;
}

export const kEdnaFileExt = ".edna.txt";
const kEdnaEncrFileExt = ".encr.edna.txt";

function isEncryptedEdnaFile(fileName: string): boolean {
  return fileName.endsWith(kEdnaEncrFileExt);
}
function isEdnaFile(fileName: string): boolean {
  return fileName.endsWith(kEdnaFileExt);
}

function trimEdnaExt(name: string): string {
  let s = trimSuffix(name, kEdnaEncrFileExt);
  s = trimSuffix(s, kEdnaFileExt);
  throwIf(s === name); // assumes we chacked before calling
  return s;
}

export function notePathFromNameFS(name: string, isEncr?: boolean): string {
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

function notePathFromNameLS(name: string): string {
  let isEncr = isEncryptedNote(name);
  if (isEncr) {
    return kLSKeyEncrPrefix + name;
  }
  return kLSKeyPrefix + name;
}

export function notePathFromName(name: string): string {
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

export function isSystemNoteName(name: string): boolean {
  return systemNotes.includes(name);
}

export const blockHdrPlainText = "\n∞∞∞text-a\n";
export const blockHdrMarkdown = "\n∞∞∞markdown\n";
export const blockHdrJSON = "\n∞∞∞json\n";
export const blockHdrPHP = "\n∞∞∞php\n";

export async function createIfNotExists(name: string, content: string, existingNotes?: string[]): Promise<number> {
  if (!existingNotes) {
    existingNotes = appState.allNotes;
  }
  if (existingNotes.includes(name)) {
    console.log(`note ${name} already exists`);
    return 0;
  }
  await createNoteWithName(name, content);
  return 1;
}

export async function createDefaultNotes(existingNotes: string[]): Promise<number> {
  let isFirstRun = getStats().appOpenCount < 2;
  console.log(`isFirstRun: ${isFirstRun}, len(existingNotes): ${len(existingNotes)}`);
  if (len(existingNotes) == 0) {
    // scenario: moved notes to disk and switched back to local storage
    isFirstRun = true;
  }

  let welcomeNote = getWelcomeNote();

  let nCreated = await createIfNotExists(kScratchNoteName, welcomeNote, existingNotes);
  // scratch note must always exist but the user can delete inbox / daily journal notes
  if (isFirstRun) {
    let inbox = getInboxNote();
    nCreated += await createIfNotExists(kInboxNoteName, inbox, existingNotes);
    // re-create those notes if the user hasn't deleted them
    let journal = getJournalNote();
    nCreated += await createIfNotExists(kDailyJournalNoteName, journal, existingNotes);
  }
  if (nCreated > 0) {
    await loadNoteNames();
  }
  if (isFirstRun) {
    await loadNotesMetadata(); // must pre-load to make them available
    await reassignNoteShortcut(kScratchNoteName, "1");
    await reassignNoteShortcut(kDailyJournalNoteName, "2");
    await reassignNoteShortcut(kInboxNoteName, "3");
  }
  return nCreated;
}

function getLSKeys(): string[] {
  let nKeys = localStorage.length;
  let keys: string[] = [];
  for (let i = 0; i < nKeys; i++) {
    const key = localStorage.key(i) as string;
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

function loadNoteNamesLS(): string[][] {
  function getNoteNameLS(notePath: string): string {
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

let encryptedNoteNames: string[] = [];

interface OpenedNote {
  handle: FileSystemFileHandle;
  fileName: string;
  noteName: string;
}

// list of notes opened from disk. They are not part of the workspace, will be forgotten
// on app reload. Their names are their full fileNames which helps to ensure that
// their names don't conflict with notes in the workspace
// TODO: maybe add some unique prefix to the name (like `system:` for system notes?)
let openedNotes: OpenedNote[] = [];

function getOpenedNote(noteName: string): OpenedNote | null {
  for (let i of openedNotes) {
    if (i.noteName === noteName) {
      return i;
    }
  }
  return null;
}

export function unrememberOpenedNote(noteName: string) {
  openedNotes = openedNotes.filter((openedNote) => openedNote.noteName !== noteName);
  appState.allNotes = appState.allNotes.filter((name) => name != noteName);
}

export function rememberOpenedNote(fh: FileSystemFileHandle): string | null {
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
  while (appState.allNotes.includes(noteName)) {
    noteName = baseNoteName + `-${n}`;
    n++;
  }
  let opened = {
    handle: fh,
    fileName: fh.name,
    noteName: noteName,
  };
  openedNotes.push(opened);
  appState.allNotes.push(noteName);
  return noteName;
}

export function noteNameFromFileNameFS(fileName: string): string | null {
  // throwIf(!isValidFileName(fileName));
  if (!isValidFileName(fileName)) {
    return null;
  }
  let encodedName = trimEdnaExt(fileName);
  let name = fromFileName(encodedName);
  return name;
}

export async function ensureValidNoteNamesFS(dh: FileSystemDirectoryHandle): Promise<void> {
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

export async function forEachNoteFileFS(
  dh: FileSystemDirectoryHandle,
  fn: (fileName: string, noteName: string, isEncr: boolean) => Promise<void>,
) {
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

async function loadNoteNamesFS(dh: FileSystemDirectoryHandle): Promise<string[][]> {
  let all: string[] = [];
  let encrypted: string[] = [];
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

export async function loadNoteNames(): Promise<string[]> {
  console.log("loadNoteNames");
  let dh = getStorageFS();
  let res: string[][] = [];
  if (!dh) {
    res = loadNoteNamesLS();
  } else {
    res = await loadNoteNamesFS(dh);
  }

  // TODO: got a case where I had both foo.edna.txt and foo.encr.edna.txt which caused
  // duplicate names which cased note selector to fail due to duplicate key
  // don't quite know how this happened but it could be done maliciously
  appState.allNotes = removeDuplicates(res[0] || []);
  encryptedNoteNames = removeDuplicates(res[1] || []);
  // console.log("loadNoteNames() res:", res);
  return appState.allNotes;
}

export function startsWithBlockHeader(s: string): boolean {
  return s.startsWith("\n∞∞∞");
}

// in case somehow a note doesn't start with the block header, fix it up
export function fixUpNoteContent(s: string | null): string {
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

function getSystemNoteContent(name: string): string {
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

function pickUniqueName(base: string, existingNames: string[]): string {
  let name = base;
  let i = 1;
  while (existingNames.includes(name)) {
    name = base + "-" + i;
    i++;
  }
  return name;
}

export async function saveNote(name: string, content: string) {
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
    console.log("saveNote: ok:", ok);
    await fsFileHandleWriteText(fh, content);
    appState.isDirty = false;
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
  appState.isDirty = false;
  incNoteSaveCount();
}

export async function createNoteWithName(name: string, content: string | null = null) {
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

export async function appendToNote(name: string, content: string) {
  throwIf(!startsWithBlockHeader(content), "content must start with block header ~~~");

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
    newContent = oldContent + content;
    incNoteSaveCount();
  } else {
    incNoteCreateCount();
  }
  await writeMaybeEncryptedFS(dh, name, newContent);
}

export async function createNewScratchNote(): Promise<string> {
  let noteNames = await loadNoteNames();
  // generate a unique "scratch-${N}" note name
  let scratchName = pickUniqueName("scratch", noteNames);
  await createNoteWithName(scratchName);
  return scratchName;
}

function isEncryptedNote(name: string): boolean {
  let res = encryptedNoteNames.includes(name);
  return res;
}

function loadNoteLS(name: string): string | undefined {
  let key = kLSKeyPrefix + name;
  if (isEncryptedNote(name)) {
    key = kLSKeyEncrPrefix + name;
  }
  let res = localStorage.getItem(key);
  return res ? res : undefined;
}

export function noteExists(name: string): boolean {
  let notes = appState.allNotes;
  return notes.includes(name) || isSystemNoteName(name);
}

export async function loadNoteIfExists(name: string): Promise<string | undefined> {
  if (!noteExists(name)) {
    return;
  }
  return await loadNote(name);
}

export async function loadNote(name: string): Promise<string | undefined> {
  // console.log("loadNote:", name);
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
  if (!res) {
    return;
  }
  return fixUpNoteContent(res);
}

async function readMaybeEncryptedNoteFS(dh: FileSystemDirectoryHandle, name: string): Promise<string> {
  let path = notePathFromNameFS(name);
  if (!isEncryptedEdnaFile(path)) {
    let res = await fsReadTextFile(dh, path);
    return res;
  }
  let res = await readEncryptedFS(dh, path);
  return res;
}

async function readEncryptedFS(dh: FileSystemDirectoryHandle, fileName: string): Promise<string> {
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

async function writeMaybeEncryptedFS(dh: FileSystemDirectoryHandle, name: string, content: string): Promise<void> {
  let path = notePathFromNameFS(name);
  if (!isEncryptedNote(name)) {
    await fsWriteTextFile(dh, path, content);
    return;
  }
  let pwdHash = await getPasswordHashMust("");
  throwIf(!pwdHash, "needs password");
  await writeEncryptedFS(dh, pwdHash, path, content);
}

async function writeEncryptedFS(
  dh: FileSystemDirectoryHandle,
  pwdHash: string,
  fileName: string,
  s: string,
): Promise<void> {
  let d = await encryptStringAsBlob({ key: pwdHash, plaintext: s });
  let blob = blobFromUint8Array(d);
  await fsWriteBlob(dh, fileName, blob);
}

export async function writeNoteFS(dh: FileSystemDirectoryHandle, name: string, content: string) {
  let isEncr = isUsingEncryption();
  const path = notePathFromNameFS(name, isEncr);
  if (!isEncr) {
    await fsWriteTextFile(dh, path, content);
    return;
  }
  let pwdHash = await getPasswordHashMust("");
  await writeEncryptedFS(dh, pwdHash, path, content);
}

export function canDeleteNote(name: string): boolean {
  if (name === kScratchNoteName) {
    return false;
  }
  let openedNote = getOpenedNote(name);
  if (openedNote) {
    return false;
  }
  return !isSystemNoteName(name);
}

export function isNoteTrashable(name: string): boolean {
  if (name === kScratchNoteName) {
    return false;
  }
  let openedNote = getOpenedNote(name);
  if (openedNote) {
    return false;
  }
  return !isSystemNoteName(name);
}

export function isNoteArchivable(name: string): boolean {
  return isNoteTrashable(name);
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

export async function deleteNote(name: string) {
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

export async function renameNote(oldName: string, newName: string, content: string) {
  await createNoteWithName(newName, content);
  // update metadata and history before deleteNote() because it'll
  // remove from history and metadata
  await renameNoteInMetadata(oldName, newName);
  renameNoteInHistory(oldName, newName);
  let settings = getSettings();
  let idx = settings.tabs.indexOf(oldName);
  if (idx >= 0) {
    settings.tabs[idx] = newName;
  }
  await deleteNote(oldName);
}

async function migrateNote(noteName: string, diskNoteNames: string[], dh: FileSystemDirectoryHandle) {
  let name = noteName;
  let noteInfoOnDisk: string | undefined;
  for (let ni of diskNoteNames) {
    if (ni === name) {
      noteInfoOnDisk = ni;
      break;
    }
  }
  let content = loadNoteLS(noteName) || "";
  if (!noteInfoOnDisk) {
    // didn't find a note with the same name so create
    let fileName = notePathFromNameFS(name);
    await fsWriteTextFile(dh, fileName, content);
    console.log("migrateNote: created new note", fileName, "from note with name", name);
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
  console.log("migrateNote: created new note", fileName, "because of different content with", name);
}

// when notes are stored on disk, they can be stored on replicated online
// storage like OneDrive
// just in case we pre-load them to force downloading them to local drive
// to make future access faster
export async function preLoadAllNotes(): Promise<number | undefined> {
  let dh = getStorageFS();
  if (!dh) {
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

async function moveLSToFS(lsKeyName: string, dh: FileSystemDirectoryHandle, fileName: string) {
  console.log("moveLSToFS:", lsKeyName, fileName, dh.name);
  let s = localStorage.getItem(lsKeyName);
  if (s === null) {
    return;
  }
  await fsWriteTextFile(dh, fileName, s);
  localStorage.removeItem(lsKeyName);
}

export async function switchToStoringNotesOnDisk(dh: FileSystemDirectoryHandle) {
  console.log("switchToStoringNotesOnDisk");
  let res = await loadNoteNamesFS(dh);
  let diskNoteNames = res[0] as string[];

  // migrate notes
  let latestNoteNames = appState.allNotes;
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
  let settings = getSettings();
  let name = settings.currentNoteName;
  if (!noteNames.includes(name)) {
    settings.currentNoteName = kScratchNoteName;
  }
  return noteNames;
}

export async function pickAnotherDirectory(): Promise<boolean> {
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

export function sanitizeNoteName(name: string): string {
  let res = name.trim();
  return res;
}

export function getNotesCount(): number {
  return len(appState.allNotes);
}

export function isUsingEncryption(): boolean {
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

async function encryptNoteFS(dh: FileSystemDirectoryHandle, oldFileName: string, pwdHash: string) {
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

async function decryptNoteFS(dh: FileSystemDirectoryHandle, oldFileName: string) {
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

function saltPassword(pwd: string): string {
  let pwdHash = hash({ key: pwd, salt: kEdnaSalt });
  return pwdHash;
}

export async function encryptAllNotes(pwd: string) {
  let dh = getStorageFS();
  throwIf(!db, "no encryption for local storage notes");
  if (!dh) {
    return;
  }
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
  if (!dh) {
    return;
  }
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
