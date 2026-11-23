import { tick } from "svelte";
import { decryptBlobAsString, encryptStringAsBlob, hash } from "kiss-crypto";
import { appState } from "./appstate.svelte";
// @ts-ignore
import { clearModalMessage, showModalMessageHTML } from "./components/ModalMessage.svelte";
import {
  isTabHome,
  kBuiltInFunctionsNoteName,
  kDailyJournalNoteName,
  kEdnaEncrFileExt,
  kEdnaFileExt,
  kHelpSystemNoteName,
  kInboxNoteName,
  kReleaseNotesSystemNoteName,
  kScratchNoteName,
  kWelcomeDevSystemNoteName,
  kWelcomeSystemNoteName,
} from "./constants";
import { KV } from "./dbutil";
import { getBlockDelimiter, kDelimiterPrefix } from "./editor/new-parser/node-types";
import { fromFileName, isValidFileName, toFileName } from "./filenamify";
import {
  blobFromUint8Array,
  fsDeleteFile,
  fsFileHandleReadTextFile,
  fsFileHandleWrite,
  fsReadBinaryFile,
  fsReadTextFile,
  fsWriteFile,
  openDirPicker,
  readDir,
} from "./fileutil";
import { getPasswordFromUser, requestFileWritePermission } from "./globals";
import { removeNoteFromHistory, renameNoteInHistory } from "./history.js";
import {
  kMetadataName,
  type Metadata,
  loadNotesMetadata,
  readStoredMetadata,
  reassignNoteShortcut,
  removeNoteFromMetadata,
  removeStaleNoteMeta,
  renameNoteInMetadata,
  writeMetadataFile,
} from "./metadata";
import { mergeMetadata, normalizeMetadata } from "./metadata-merge";
import { fixUpNoteContent } from "./note-content";
import { noteNameError } from "./note-name";
import { getSettings } from "./settings.svelte";
import { incNoteCreateCount, incNoteDeleteCount, incNoteSaveCount } from "./state";
import {
  getBuiltInFunctionsNote,
  getHelp,
  getInboxNote,
  getJournalNote,
  getReleaseNotes,
  getWelcomeNote,
  getWelcomeNoteDev,
} from "./system-notes";
import { arrayReplace, KeyedSerialQueue, valueOrUndefined, escapeHTML, html, len, removeDuplicates, throwIf, trimSuffix } from "./util";

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
  setStorageFS(undefined);
}

// some things, like FilesystemDirectoryHandle, we need to store in indexedDb
const db = new KV("edna", "keyval");

const kStorageDirHandleKey = "storageDirHandle";

const kLSPassowrdKey = "edna-password";

function rememberPassword(pwd: string) {
  localStorage.setItem(kLSPassowrdKey, pwd);
  verifiedPassword = undefined;
}

function removePassword() {
  localStorage.removeItem(kLSPassowrdKey);
  verifiedPassword = undefined;
}

function getPasswordHash(): string | undefined {
  let pwd = localStorage.getItem(kLSPassowrdKey);
  if (!pwd) {
    return;
  }
  let pwdHash = saltPassword(pwd);
  return pwdHash;
}

// thrown when the user cancels the password dialog
export class PasswordCancelledError extends Error {
  constructor() {
    super("password not provided");
    this.name = "PasswordCancelledError";
  }
}

// returns true if pwdHash decrypts encrypted notes in the directory; true if
// there are no encrypted notes. Tries a few notes so that one damaged file
// doesn't make the right password look wrong
async function passwordHashDecryptsNotes(dh: FileSystemDirectoryHandle, pwdHash: string): Promise<boolean> {
  const maxToTry = 5;
  let encrFileNames: string[] = [];
  await forEachNoteFileFS(dh, async (fileName, noteName, isEncr) => {
    if (isEncr && encrFileNames.length < maxToTry) {
      encrFileNames.push(fileName);
    }
  });
  if (encrFileNames.length === 0) {
    return true;
  }
  for (let fileName of encrFileNames) {
    if ((await tryDecryptFileFS(dh, fileName, pwdHash)) !== null) {
      return true;
    }
  }
  return false;
}

// content of encrypted file fileName, or null if pwdHash doesn't decrypt it
async function tryDecryptFileFS(dh: FileSystemDirectoryHandle, fileName: string, pwdHash: string): Promise<string | null> {
  let d = await fsReadBinaryFile(dh, fileName);
  try {
    return decryptBlobAsString({ key: pwdHash, cipherblob: d });
  } catch {
    return null;
  }
}

// asks the user for a password until it decrypts existing notes (P-I1).
// throws PasswordCancelledError if the user cancels (P-I2)
async function askForPasswordHash(msg: string, dh = getStorageFS()): Promise<string> {
  while (true) {
    let pwd = await getPasswordFromUser(msg);
    if (!pwd) {
      throw new PasswordCancelledError();
    }
    let pwdHash = await acceptPassword(pwd, dh);
    if (pwdHash) {
      return pwdHash;
    }
    msg = "Password is not correct. Please enter valid password.";
  }
}

// if password pwd decrypts the notes in dh (or there's no dh), remembers it and
// returns its hash; otherwise undefined
async function acceptPassword(pwd: string, dh: FileSystemDirectoryHandle | undefined): Promise<string | undefined> {
  let pwdHash = saltPassword(pwd);
  if (dh && !(await passwordHashDecryptsNotes(dh, pwdHash))) {
    return undefined;
  }
  rememberPassword(pwd);
  return pwdHash;
}

// concurrent requests for a password share one dialog (P-I3)
let pendingPasswordHash: Promise<string> | undefined;

// directory and password hash that was verified to decrypt its notes. The
// password is remembered globally but it belongs to a directory (U3)
let verifiedPassword: { dh: FileSystemDirectoryHandle; pwdHash: string } | undefined;

// remembered password hash if it decrypts notes in dh (forgets it if not)
async function getVerifiedPasswordHash(dh: FileSystemDirectoryHandle | undefined): Promise<string | undefined> {
  let pwdHash = getPasswordHash();
  if (!pwdHash || !dh) {
    return pwdHash;
  }
  if (verifiedPassword && verifiedPassword.dh === dh && verifiedPassword.pwdHash === pwdHash) {
    return pwdHash;
  }
  if (await passwordHashDecryptsNotes(dh, pwdHash)) {
    verifiedPassword = { dh, pwdHash };
    return pwdHash;
  }
  // remembered from another directory
  removePassword();
  return undefined;
}

async function getPasswordHashMust(msg: string): Promise<string> {
  if (!pendingPasswordHash) {
    let dh = getStorageFS();
    pendingPasswordHash = getPasswordHashForDir(dh, msg).finally(() => {
      pendingPasswordHash = undefined;
    });
  }
  return pendingPasswordHash;
}

export async function dbGetDirHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  let dh = await db.get(kStorageDirHandleKey);
  if (!dh) return;
  setStorageFS(dh);
  return storageFS;
}

export async function dbSetDirHandle(dh: FileSystemDirectoryHandle) {
  await db.set(kStorageDirHandleKey, dh);
  switchStorage(dh);
}

// notes are now stored in dh (undefined: localStorage)
function switchStorage(dh: FileSystemDirectoryHandle | undefined) {
  setStorageFS(dh);
  // names of notes opened from disk were made unique for the previous storage (U6)
  openedNotes = [];
}

export async function dbDelDirHandle() {
  await db.del(kStorageDirHandleKey);
  switchStorage(undefined);
}

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

export async function createIfNotExists(name: string, content: string, existingNotes?: string[]): Promise<number> {
  if (!existingNotes) {
    existingNotes = appState.allNotes;
  }
  // names are unique ignoring case (U4): creating would throw
  if (findNoteIgnoreCase(name, existingNotes)) {
    console.log(`note ${name} already exists`);
    return 0;
  }
  await createNoteWithName(name, content);
  return 1;
}

export async function createDefaultNotes(existingNotes: string[]): Promise<number> {
  // a store without notes: a new user, or switched back to local storage after
  // moving notes to disk. Not "first time the app runs": that's also true for a
  // directory with existing notes picked in the first session, where we must not
  // re-create deleted notes or take over their shortcuts
  let isFirstRun = len(existingNotes) == 0;
  console.log(`isFirstRun: ${isFirstRun}, len(existingNotes): ${len(existingNotes)}`);

  // the app opens "scratch" by name: a case variant (e.g. "Scratch.edna.txt"
  // created outside Edna) becomes "scratch"
  let scratchVariant = findNoteIgnoreCase(
    kScratchNoteName,
    existingNotes.filter((n) => n !== kScratchNoteName),
  );
  if (scratchVariant && !existingNotes.includes(kScratchNoteName)) {
    let content = (await loadNote(scratchVariant)) ?? "";
    await renameNote(scratchVariant, kScratchNoteName, fixUpNoteContent(content));
    existingNotes = await loadNoteNames();
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

// localStorage keys that store notes (regular or encrypted)
function getNoteKeysLS(): { key: string; isEncr: boolean }[] {
  let res = [];
  for (let key of getLSKeys()) {
    let isEncr = key.startsWith(kLSKeyEncrPrefix);
    if (isEncr || key.startsWith(kLSKeyPrefix)) {
      res.push({ key, isEncr });
    }
  }
  return res;
}

export function debugRemoveLocalStorageNotes() {
  for (let { key } of getNoteKeysLS()) {
    localStorage.removeItem(key);
    console.log(`removed ${key}`);
  }
  localStorage.removeItem(kMetadataName);
}

// [all note names, names of encrypted notes]
function splitNoteNames(notes: { name: string; isEncr: boolean }[]): string[][] {
  return [notes.map((n) => n.name), notes.filter((n) => n.isEncr).map((n) => n.name)];
}

function loadNoteNamesLS(): string[][] {
  function getNoteNameLS(notePath: string): string {
    const i = notePath.indexOf(":");
    return notePath.substring(i + 1);
  }

  return splitNoteNames(getNoteKeysLS().map(({ key, isEncr }) => ({ name: getNoteNameLS(key), isEncr })));
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

export function rememberOpenedNote(fh: FileSystemFileHandle): string | null {
  if (isEncryptedEdnaFile(fh.name)) {
    // we don't support encrypted notes
    return null;
  }
  if (!isEdnaFile(fh.name)) {
    // the file picker's type filter isn't a guarantee: trimEdnaExt() would
    // throw for other files
    return null;
  }
  let noteName = noteNameFromFileNameFS(fh.name);
  if (!noteName || noteNameError(noteName)) {
    return null;
  }

  // unique ignoring case among notes of the current storage (U4). Forgotten when
  // the storage changes (U6)
  noteName = pickUniqueName(noteName, appState.allNotes);
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
    // null for an invalid file name
    let name = noteNameFromFileNameFS(fileName);
    // filter out empty names, can be created maliciously or due to a bug
    if (name === null || name === "") {
      continue;
    }
    let isEncr = isEncryptedEdnaFile(fileName);
    await fn(fileName, name, isEncr);
  }
}

async function loadNoteNamesFS(dh: FileSystemDirectoryHandle): Promise<string[][]> {
  let notes: { name: string; isEncr: boolean }[] = [];
  await forEachNoteFileFS(dh, async (fileName, name, isEncr) => {
    notes.push({ name, isEncr });
  });
  return splitNoteNames(notes);
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
  let names = res[0] || [];
  // notes opened from disk (outside of the workspace) are part of all notes
  for (let o of openedNotes) {
    names.push(o.noteName);
  }
  appState.allNotes = removeDuplicates(names);
  encryptedNoteNames = removeDuplicates(res[1] || []);
  // console.log("loadNoteNames() res:", res);
  return appState.allNotes;
}

export function startsWithBlockHeader(s: string): boolean {
  return s.startsWith("\n" + kDelimiterPrefix);
}

// s as content of a new block: prepends an auto-detected text block header if s has no header
export function ensureBlockHeader(s: string): string {
  return startsWithBlockHeader(s) ? s : getBlockDelimiter("text", true) + s;
}

export { fixUpNoteContent };

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

// returns base or base-N that is not in existingNames, ignoring case because
// names are unique ignoring case (U4)
function pickUniqueName(base: string, existingNames: string[]): string {
  return pickUniqueNameIgnoreCase(base, new Set(existingNames.map((n) => n.toLowerCase())));
}

// writes to the same note are serialized so that they complete in order
const saveQueues = new KeyedSerialQueue();

export interface SaveResult {
  // set if the note was changed elsewhere (e.g. in another Edna tab) and
  // content was saved as this new note instead (issue 15g)
  conflictName?: string;
}

// true if the stored note differs from both base (what the caller loaded /
// last saved) and content (what it wants to save): someone else changed it
async function isChangedElsewhere(name: string, content: string, base: string): Promise<boolean> {
  // can't read it (e.g. deleted): nothing to protect
  let stored = await tryLoadNote(name);
  if (stored === undefined) {
    return false;
  }
  return stored !== fixUpNoteContent(base) && stored !== fixUpNoteContent(content);
}

// Saves note content. Throws if the note couldn't be saved.
// If base is given (the content the caller loaded or last saved) and the
// stored note was changed elsewhere since, it's not overwritten: content is
// saved as a new note (see SaveResult).
// Note: storage location is determined synchronously, when called.
export function saveNote(name: string, content: string, base?: string): Promise<SaveResult> {
  if (isSystemNoteName(name)) {
    console.log("skipped saving system note", name);
    return Promise.resolve({});
  }
  let openedNote = getOpenedNote(name);
  let dh = getStorageFS();
  // note: the check and the write run in the queue so they're not interleaved
  // with other saves of this note
  return saveQueues.run(name, async (): Promise<SaveResult> => {
    if (base !== undefined && (await isChangedElsewhere(name, content, base))) {
      // re-read names: another tab might have created a conflict copy too
      let conflictName = pickUniqueName(name + "-conflict", await loadNoteNames());
      await createNoteWithName(conflictName, content);
      return { conflictName };
    }
    await saveNoteNow(name, content, openedNote, dh);
    return {};
  });
}

async function saveNoteNow(
  name: string,
  content: string,
  openedNote: OpenedNote | null,
  dh: FileSystemDirectoryHandle | undefined,
) {
  if (openedNote) {
    let fh = openedNote.handle;
    let ok = await requestFileWritePermission(fh);
    if (!ok) {
      throw new Error(`no permission to write file '${fh.name}'`);
    }
    await fsFileHandleWrite(fh, content);
  } else if (!dh) {
    let path = notePathFromNameLS(name);
    localStorage.setItem(path, content);
  } else {
    await writeMaybeEncryptedFS(dh, name, content);
  }
  incNoteSaveCount();
}

function assertValidNoteName(name: string) {
  let nameErr = noteNameError(name);
  if (nameErr) {
    throw new Error(`invalid note name '${name}': ${nameErr}`);
  }
}

// creates a new note. Throws if a note with this name (ignoring case) already
// exists, to never overwrite an existing note (N-I1)
export async function createNoteWithName(name: string, content: string | null = null) {
  assertValidNoteName(name);
  // re-read names: a note created by another tab or a sync tool since they
  // were last read would be overwritten (U30)
  await loadNoteNames();
  let existing = findNoteIgnoreCase(name);
  if (existing) {
    throw new Error(`note '${existing}' already exists`);
  }
  await removeStaleNoteMeta(name);
  await writeNewNote(name, fixUpNoteContent(content));
}

// writes content as new note name (in a directory: encrypted if notes are)
async function writeNewNote(name: string, content: string) {
  let dh = getStorageFS();
  if (dh) {
    await writeNoteFS(dh, name, content);
  } else {
    localStorage.setItem(notePathFromName(name), content);
  }
  incNoteCreateCount();
  await loadNoteNames();
}

export async function appendToNote(name: string, content: string) {
  throwIf(!startsWithBlockHeader(content), "content must start with block header ~~~");
  // re-read names: appending to a note we don't know about would overwrite it (U30)
  await loadNoteNames();
  // append to existing note even if the name differs in case, instead of
  // creating a note that would overwrite it on case-insensitive file systems
  name = findNoteIgnoreCase(name) || name;
  // system notes "exist" but their content is built in
  if (isSystemNoteName(name) || !noteExists(name)) {
    assertValidNoteName(name);
    await removeStaleNoteMeta(name);
  }

  let dh = getStorageFS();
  let oldContent = dh ? (noteExists(name) ? ((await loadNote(name)) ?? "") : undefined) : loadNoteLS(name);
  if (oldContent === undefined) {
    await writeNewNote(name, content);
    return;
  }
  await saveNoteNow(name, oldContent + content, null, dh);
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

// note content, or undefined if it doesn't exist or can't be read
export function tryLoadNote(name: string): Promise<string | undefined> {
  return valueOrUndefined(loadNote(name));
}

function loadNoteLS(name: string): string | undefined {
  let res = localStorage.getItem(notePathFromNameLS(name));
  return res ?? undefined;
}

// file names are case-insensitive on macOS and Windows so "Foo" and "foo"
// would be the same file. Returns existing note whose name differs only by case
export function findNoteIgnoreCase(name: string, names: string[] = appState.allNotes): string | undefined {
  let nameLC = name.toLowerCase();
  return names.find((n) => n.toLowerCase() === nameLC);
}

// returns HTML explaining why name can't be used for a new / renamed note,
// or "" if it can. allowedExisting is a note name that may match (the note being renamed)
export function noteNameUnavailableHTML(name: string, allowedExisting?: string): string {
  let nameErr = noteNameError(name);
  if (nameErr) {
    return escapeHTML(nameErr);
  }
  let existing = findNoteIgnoreCase(name);
  if (existing && existing !== allowedExisting) {
    return `note <span class="font-bold">${escapeHTML(existing)}</span> already exists`;
  }
  return "";
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
  if (res === undefined || res === null) {
    return;
  }
  // also an empty note: it must be a valid document (U9)
  return fixUpNoteContent(res);
}

async function readMaybeEncryptedNoteFS(dh: FileSystemDirectoryHandle, name: string): Promise<string> {
  return readTextFS(dh, notePathFromNameFS(name));
}

// reads note file, decrypting it if it's an encrypted note file
async function readTextFS(dh: FileSystemDirectoryHandle, path: string): Promise<string> {
  if (isEncryptedEdnaFile(path)) {
    return readEncryptedFS(dh, path);
  }
  return fsReadTextFile(dh, path);
}

async function readEncryptedFS(dh: FileSystemDirectoryHandle, fileName: string): Promise<string> {
  let msg = "";
  while (true) {
    let pwdHash = await getPasswordHashMust(msg);
    let s = await tryDecryptFileFS(dh, fileName, pwdHash);
    if (s !== null) {
      return s;
    }
    if (await passwordHashDecryptsNotes(dh, pwdHash)) {
      // the password decrypts other notes: this file is damaged or encrypted
      // with a different key, asking for the password again wouldn't help
      throw new Error(`can't decrypt '${fileName}'`);
    }
    let pwd = localStorage.getItem(kLSPassowrdKey);
    if (!pwd) {
      msg = "Please enter password to decrypt files";
    } else {
      msg = "Password is not correct. Please enter valid password.";
    }
    // password was likely incorrect so remove it so that getPasswordHashMust()
    // asks the user
    removePassword();
  }
}

async function writeMaybeEncryptedFS(dh: FileSystemDirectoryHandle, name: string, content: string): Promise<void> {
  await writeTextFS(dh, notePathFromNameFS(name), content, isEncryptedNote(name));
}

// write content to path, encrypted if encrypt is true (with pwdHash or,
// if not given, the user's password)
async function writeTextFS(
  dh: FileSystemDirectoryHandle,
  path: string,
  content: string,
  encrypt: boolean,
  pwdHash?: string,
): Promise<void> {
  if (!encrypt) {
    await fsWriteFile(dh, path, content);
    return;
  }
  pwdHash ??= await getPasswordHashMust("");
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
  await fsWriteFile(dh, fileName, blob);
}

export async function writeNoteFS(dh: FileSystemDirectoryHandle, name: string, content: string) {
  let isEncr = isUsingEncryption();
  await writeTextFS(dh, notePathFromNameFS(name, isEncr), content, isEncr);
}

// scratch and system notes can't be renamed or deleted
export function isProtectedNote(name: string): boolean {
  return name === kScratchNoteName || isSystemNoteName(name);
}

export function canDeleteNote(name: string): boolean {
  // notes opened from disk aren't ours to delete
  return !isProtectedNote(name) && !getOpenedNote(name);
}

export function isNoteArchivable(name: string): boolean {
  return canDeleteNote(name);
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
  assertValidNoteName(newName);
  let dh = getStorageFS();
  if (oldName !== newName && oldName.toLowerCase() === newName.toLowerCase()) {
    await renameNoteCaseOnly(dh, oldName, newName, content);
    return;
  }
  await createNoteWithName(newName, content);
  // update metadata and history before deleteNote() because it'll
  // remove from history and metadata
  await renameNoteReferences(oldName, newName);
  await deleteNote(oldName);
}

// point metadata, history and open tabs at the new note name
async function renameNoteReferences(oldName: string, newName: string) {
  await renameNoteInMetadata(oldName, newName);
  renameNoteInHistory(oldName, newName);
  arrayReplace(getSettings().tabs, oldName, newName);
}

// on case-insensitive file systems (macOS, Windows) "Foo" and "foo" are the same
// file, so creating the new note and deleting the old one would delete the note
// note: createNoteWithName() refuses names that differ only in case
async function renameNoteCaseOnly(
  dh: FileSystemDirectoryHandle | undefined,
  oldName: string,
  newName: string,
  content: string,
) {
  if (!dh) {
    localStorage.setItem(notePathFromNameLS(newName), content);
    localStorage.removeItem(notePathFromNameLS(oldName));
  } else {
    await fsDeleteFile(dh, notePathFromNameFS(oldName));
    try {
      await writeNoteFS(dh, newName, content);
    } catch (e) {
      await writeNoteFS(dh, oldName, content);
      throw e;
    }
  }
  await renameNoteReferences(oldName, newName);
  await loadNoteNames();
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
  await forEachNoteFileFS(dh, async (fileName, noteName, isEncr) => {
    try {
      await fsReadBinaryFile(dh, fileName);
      n++;
    } catch (e) {
      console.log(`preLoadAllNotes: failed to read '${fileName}'`, e);
    }
  });
  return n;
}

// returns a name not in `used` (compared case-insensitively)
function pickUniqueNameIgnoreCase(base: string, used: Set<string>): string {
  let name = base;
  for (let i = 1; used.has(name.toLowerCase()); i++) {
    name = base + "-" + i;
  }
  return name;
}

// password hash that decrypts the notes in dh (remembered or asked for with msg)
async function getPasswordHashForDir(
  dh: FileSystemDirectoryHandle | undefined,
  msg = "Please enter password of notes in this directory",
): Promise<string> {
  let pwdHash = await getVerifiedPasswordHash(dh);
  if (pwdHash) {
    return pwdHash;
  }
  pwdHash = await askForPasswordHash(msg, dh);
  if (dh) {
    verifiedPassword = { dh, pwdHash };
  }
  return pwdHash;
}

/**
 * Moves notes from localStorage to directory dh (which might already have
 * notes) and switches to storing notes in dh. Keeps S-I2: no note is lost or
 * overwritten:
 * - a note whose name is taken in the directory (ignoring case) and has
 *   different content gets a unique name
 * - if the directory has encrypted notes, moved notes are encrypted too
 * - notes are removed from localStorage only after everything was written
 * Returns map of renamed notes (old name => new name).
 */
export async function switchToStoringNotesOnDisk(dh: FileSystemDirectoryHandle): Promise<Map<string, string>> {
  return exclusiveStorageOp("move notes to directory", async () => {
    console.log("switchToStoringNotesOnDisk");
    let [diskNames, diskEncrNames] = await loadNoteNamesFS(dh);
    let lsNames = appState.allNotes.filter((name) => !isSystemNoteName(name) && !getOpenedNote(name));
    let encrypt = len(diskEncrNames!) > 0;
    let pwdHash = encrypt ? await getPasswordHashForDir(dh) : "";

    // names taken in the directory or by notes being moved, lower-cased
    // because file systems can be case-insensitive
    let used = new Set<string>([...diskNames!, ...lsNames].map((n) => n.toLowerCase()));
    let diskByLC = new Map(diskNames!.map((n) => [n.toLowerCase(), n]));
    let renamed = new Map<string, string>();
    // lower-cased names written to the directory: localStorage keys are
    // case-sensitive so "foo" and "Foo" can both exist (U4)
    let written = new Set<string>();

    for (let name of lsNames) {
      let content = loadNoteLS(name) || "";
      let lsName = name;
      // moves the note under a unique name
      let moveAsUnique = (why: string) => {
        let newName = pickUniqueNameIgnoreCase(name, used);
        used.add(newName.toLowerCase());
        renamed.set(lsName, newName);
        console.log(`switchToStoringNotesOnDisk: '${name}' ${why}, moving as '${newName}'`);
        name = newName;
      };
      if (noteNameError(name)) {
        // e.g. "foo.encr" would become encrypted note "foo" in the directory (U2)
        moveAsUnique("is not a valid name");
      }
      let diskName = diskByLC.get(name.toLowerCase());
      if (diskName !== undefined) {
        if (!diskEncrNames!.includes(diskName)) {
          let diskContent = await fsReadTextFile(dh, notePathFromNameFS(diskName, false));
          if (diskContent === content) {
            console.log("switchToStoringNotesOnDisk: same content, skipping", name);
            if (diskName !== name) {
              // metadata and tabs follow the note in the directory
              renamed.set(lsName, diskName);
            }
            continue;
          }
        }
        moveAsUnique("exists");
      } else if (written.has(name.toLowerCase())) {
        moveAsUnique("differs only in case from a moved note");
      }
      written.add(name.toLowerCase());
      showModalMessageHTML(html`Moving <b>${name}</b>`, 0, "storage");
      await writeTextFS(dh, notePathFromNameFS(name, encrypt), content, encrypt, pwdHash);
    }

    // merge metadata (metadata of renamed notes moves with them)
    let lsMeta = normalizeMetadata(await readStoredMetadata(undefined));
    for (let m of lsMeta.notes) {
      m.name = renamed.get(m.name) || m.name;
    }
    let diskMeta = normalizeMetadata(await readStoredMetadata(dh));
    let merged = mergeMetadata(diskMeta, lsMeta);
    await writeMetadataFile(dh, merged);

    // everything is in the directory: switch to it and remove from localStorage
    await dbSetDirHandle(dh);
    for (let name of lsNames) {
      localStorage.removeItem(notePathFromNameLS(name));
    }
    localStorage.removeItem(kMetadataName);
    await loadNoteNames();
    await loadNotesMetadata();

    // update tabs of renamed notes
    let settings = getSettings();
    settings.tabs = settings.tabs.map((tab) => renamed.get(tab) || tab);
    settings.currentTab = renamed.get(settings.currentTab) || settings.currentTab;
    return renamed;
  });
}

export async function pickAnotherDirectory(): Promise<boolean> {
  try {
    let newDh = await openDirPicker(true);
    if (!newDh) {
      return false;
    }
    await dbSetDirHandle(newDh);
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

// new notes are encrypted if the directory has encrypted notes. Note: not
// based on a remembered password, which might be for a different directory (E-I5)
export function isUsingEncryption(): boolean {
  return hasEncryptedNotes();
}

// salt for hashing the password. not sure if it helps security wise
// but it's the best we can do. We can't generate unique salts for
// each password
const kEdnaSalt = "dbd71826401a4fca6c360f065a281063";

async function fileExistsFS(dh: FileSystemDirectoryHandle, fileName: string): Promise<boolean> {
  try {
    await dh.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

// name for a copy of note `name` (encrypted or not) that doesn't exist yet
async function pickUniqueNoteNameFS(dh: FileSystemDirectoryHandle, name: string): Promise<string> {
  let [names, encrNames] = await loadNoteNamesFS(dh);
  return pickUniqueName(name, [...names!, ...encrNames!]);
}

// note "X" exists as both X.edna.txt and X.encr.edna.txt (interrupted
// operation, sync conflict): E-I1 doesn't hold. Encrypting / decrypting one
// must not overwrite the other (U5): a copy with different content gets a
// unique name, an identical copy is removed
// encrypts (encrypt = true, with pwdHash) or decrypts note file oldFileName
async function convertNoteFS(dh: FileSystemDirectoryHandle, oldFileName: string, encrypt: boolean, pwdHash = "") {
  let what = encrypt ? "encrypt" : "decrypt";
  if (isEncryptedEdnaFile(oldFileName) === encrypt) {
    console.log(`${what}NoteFS:`, oldFileName, `already ${what}ed`);
    return;
  }
  console.log(`${what}NoteFS:`, oldFileName);
  let s = await readTextFS(dh, oldFileName);
  let name = noteNameFromFileNameFS(oldFileName)!;
  let newFileName = notePathFromNameFS(name, encrypt);
  if (await fileExistsFS(dh, newFileName)) {
    let existing = await readTextFS(dh, newFileName);
    if (existing !== s) {
      let newName = await pickUniqueNoteNameFS(dh, name);
      console.log(`${what}NoteFS: '${newFileName}' exists, ${what}ing as '${newName}'`);
      newFileName = notePathFromNameFS(newName, encrypt);
    } else {
      newFileName = "";
    }
  }
  if (newFileName) {
    await writeTextFS(dh, newFileName, s, encrypt, pwdHash);
    // only delete the original once the converted file reads back the same:
    // a failed write must not lose the note (#18)
    let written = encrypt ? await tryDecryptFileFS(dh, newFileName, pwdHash) : await fsReadTextFile(dh, newFileName);
    if (written !== s) {
      await fsDeleteFile(dh, newFileName).catch(() => {});
      throw new Error(`failed to ${what} '${name}': '${newFileName}' doesn't match the original, kept '${oldFileName}'`);
    }
  }
  await fsDeleteFile(dh, oldFileName);
}

function saltPassword(pwd: string): string {
  let pwdHash = hash({ key: pwd, salt: kEdnaSalt });
  return pwdHash;
}

// name of the storage operation in progress (S-I3: at most one at a time)
let storageOpInProgress: string | undefined;

export function getStorageOpInProgress(): string | undefined {
  return storageOpInProgress;
}

async function exclusiveStorageOp<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (storageOpInProgress) {
    throw new Error(`can't ${name} while '${storageOpInProgress}' is in progress`);
  }
  storageOpInProgress = name;
  try {
    return await fn();
  } finally {
    storageOpInProgress = undefined;
    clearModalMessage("storage");
  }
}

// workspace has encrypted notes
export function hasEncryptedNotes(): boolean {
  return !!getStorageFS() && len(encryptedNoteNames) > 0;
}

// workspace (in a directory) has notes that are not encrypted
export function hasUnencryptedNotes(): boolean {
  if (!getStorageFS()) {
    return false;
  }
  return appState.allNotes.some((name) => !isEncryptedNote(name) && !getOpenedNote(name));
}

// Encrypts all notes that are not encrypted yet. Can be used to finish an
// interrupted encryption (E-I4): the password must decrypt already encrypted
// notes (E-I2).
export async function encryptAllNotes(pwd: string) {
  await exclusiveStorageOpInDir("encrypt notes", async (dh) => {
    let pwdHash = await acceptPassword(pwd, dh);
    if (!pwdHash) {
      throw new Error("password doesn't match the password of already encrypted notes");
    }
    await convertAllNotesFS(dh, true, pwdHash);
  });
}

export async function decryptAllNotes() {
  await exclusiveStorageOpInDir("decrypt notes", async (dh) => {
    await convertAllNotesFS(dh, false);
    removePassword();
  });
}

// exclusiveStorageOp() for notes stored in a directory (encryption is only
// supported there)
async function exclusiveStorageOpInDir(name: string, fn: (dh: FileSystemDirectoryHandle) => Promise<void>) {
  let dh = getStorageFS();
  throwIf(!dh, `can't ${name} stored in the browser`);
  await exclusiveStorageOp(name, () => fn(dh!));
}

// encrypts (encrypt = true) or decrypts all note files that aren't yet
async function convertAllNotesFS(dh: FileSystemDirectoryHandle, encrypt: boolean, pwdHash = "") {
  try {
    await forEachNoteFileFS(dh, async (fileName, name, isEncr) => {
      if (isEncr === encrypt) {
        return;
      }
      let msg = encrypt ? html`Encrypting <b>${name}</b>` : html`Decrypting <b>${name}</b>`;
      showModalMessageHTML(msg, 0, "storage");
      await convertNoteFS(dh, fileName, encrypt, pwdHash);
    });
  } finally {
    // also after a failure: names must match files (E-I3)
    await loadNoteNames();
  }
}
