import {
  appState,
  findNoteByName,
  getNotes,
  removeNoteFromAppState,
} from "./appstate.svelte";
import { modalInfoState } from "./components/ModalInfo.svelte";
import { rememberPassword, removePassword, saltPassword } from "./encrypt";
import { updateAfterNoteStateChange } from "./globals";
import { removeNoteFromHistory, renameNoteInHistory } from "./history";
import { getMetadata, saveAppMetadata } from "./metadata";
import { mkRandomContentId, mkRandomNoteId, Note } from "./note";
import { getSettings } from "./settings.svelte";
import {
  storeCreateNote,
  storeDecryptAllNotes,
  storeDeleteNote,
  storeEncryptAllNotes,
  storeGetString,
  storeWriteNoteContent,
  storeWriteNoteMeta,
} from "./store";
import {
  getBuiltInFunctionsNote,
  getHelp,
  getReleaseNotes,
  getWelcomeNote,
  getWelcomeNoteDev,
} from "./system-notes";
import { parseTab } from "./tab";
import { len, objectEqualDeep, throwIf } from "./util";

export const kScratchNoteName = "scratch";
export const kDailyJournalNoteName = "daily journal";
export const kInboxNoteName = "inbox";
export const kMyFunctionsNoteName = "elaris: my functions";

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

export async function createIfNotExists(name: string, content: string, existingNotes: Note[]): Promise<boolean> {
  if (!existingNotes) {
    existingNotes = appState.allNotes;
  }
  if (existingNotes.find((n) => n.name == name)) {
    console.log(`note ${name} already exists`);
    return false;
  }
  await createNoteWithName(name, content);
  return true;
}

export function startsWithBlockHeader(s: string): boolean {
  return s.startsWith("\n∞∞∞");
}

// in case somehow a note doesn't start with the block header, fix it up
export function fixUpNoteContent(s: string): string {
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

export async function saveNote(name: string, content: string): Promise<void> {
  // console.log("saveNot:", name);
  if (isSystemNoteName(name)) {
    console.log("skipped saving system note", name);
    return;
  }
  let note = findNoteByName(name);
  let verId = mkRandomContentId(note.id);
  await storeWriteNoteContent(verId, content || "");
  note.versionIds.push(verId);
  appState.isDirty = false;
}

// returns note id
export async function createNoteWithName(name: string, content: string | null = null): Promise<string> {
  content = fixUpNoteContent(content);
  let noteId = mkRandomNoteId();
  let note = await storeCreateNote(noteId, name);
  if (content) {
    let verId = mkRandomContentId(noteId);
    await storeWriteNoteContent(verId, content);
    note.versionIds.push(verId);
    console.log("created note", name);
  }
  let allNotes = [...appState.allNotes];
  allNotes.push(note);
  updateAfterNoteStateChange(allNotes);
  return note.id;
}

export async function appendToNote(name: string, content: string): Promise<void> {
  throwIf(
    !startsWithBlockHeader(content),
    "content must start with block header ~~~",
  );
  let note = findNoteByName(name);
  if (note) {
    let currContent = await loadNoteContent(name);
    let newContent = currContent + content;
    await storeWriteNoteContent(mkRandomContentId(note.id), newContent);
    return;
  }
  await createNoteWithName(name, content);
}

// creates a new ${name}<-${N}> note
export async function createNoteWithUniqueName(name: string, content: string | null = null): Promise<string> {
  let names = [];
  for (let note of appState.allNotes) {
    if (note.name.startsWith(name)) {
      names.push(note.name);
    }
  }
  let newName = pickUniqueName(name, names);
  await createNoteWithName(newName, content);
  return newName;
}

// creates a new scratch-${N} note
export async function createUniqueScratchNote(): Promise<string> {
  return await createNoteWithUniqueName(kScratchNoteName);
}

export function noteExists(name: string): boolean {
  for (let note of appState.allNotes) {
    if (note.name === name) {
      return true;
    }
  }
  if (isSystemNoteName(name)) {
    return true; // system notes always exist
  }
  return false;
}

export async function loadNoteContentIfExists(name: string): Promise<string | null> {
  if (!noteExists(name)) {
    return null;
  }
  return await loadNoteContent(name);
}

// returns null if can't read the note
export async function loadNoteContent(name: string): Promise<string> {
  // console.log("loadNote:", name);
  let res;
  if (isSystemNoteName(name)) {
    res = getSystemNoteContent(name);
    return res;
  }
  let note = findNoteByName(name);
  let lastVerId = note.versionIds[note.versionIds.length - 1];
  res = await storeGetString(lastVerId);
  return fixUpNoteContent(res);
}

export function canDeleteNote(name: string): boolean {
  if (name === kScratchNoteName) {
    return false;
  }
  return !isSystemNoteName(name);
}

export function isNoteArchivable(name: string): boolean {
  return canDeleteNote(name);
}

export async function deleteNote(name: string): Promise<void> {
  console.log("deleteNote:", name);
  let note = findNoteByName(name);
  // optimistically remove first to minimize chances note selector
  // will try to delete twice
  removeNoteFromAppState(note);
  await storeDeleteNote(note.id);
  removeNoteFromHistory(name);
  console.log(`deleteNote: ${name} finished`);
}

export async function renameNote(oldName: string, newName: string): Promise<void> {
  let note = findNoteByName(oldName);
  note.name = newName;
  await saveNoteMetadata(note);
  renameNoteInHistory(oldName, newName);
  let settings = getSettings();
  let idx = settings.tabs.indexOf(oldName);
  if (idx >= 0) {
    settings.tabs[idx] = newName;
  }
}

export function sanitizeNoteName(name: string): string {
  let res = name.trim();
  return res;
}

export function getNotesCount(): number {
  return len(appState.allNotes);
}

// altShortcut is "0" ... "9"
export async function reassignNoteShortcut(name: string, altShortcut: string): Promise<void> {
  console.log("reassignNoteShortcut:", name, altShortcut);
  let allNotes = getNotes();
  for (let note of allNotes) {
    if (note.name === name) {
      // same note: remove shortcut
      if (note.altShortcut === altShortcut) {
        // already assigned
        note.altShortcut = "";
        console.log("reassignNoteShortcut: removing shortcut from", name);
      } else {
        note.altShortcut = altShortcut;
      }
      await saveNoteMetadata(note);
      continue;
    }
    if (note.altShortcut === altShortcut) {
      // a different note: remove shortcut
      note.altShortcut = "";
      await saveNoteMetadata(note);
    }
  }
  updateAfterNoteStateChange(allNotes);
}

export async function archiveNote(name: string): Promise<void> {
  let note = findNoteByName(name);
  note.isArchived = true;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
}

export async function unArchiveNote(name: string): Promise<void> {
  let note = findNoteByName(name);
  note.isArchived = false;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
}

export async function toggleNoteStarred(name: string): Promise<boolean> {
  let note = findNoteByName(name);
  note.isStarred = !note.isStarred;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
  return note.isStarred;
}

export function isNoteArchived(name: string): boolean {
  let note = findNoteByName(name);
  return note ? note.isArchived : false;
}

export async function saveNoteMetadata(note: Note): Promise<void> {
  let m = note.getMetadata();
  await storeWriteNoteMeta(m);
}

export async function maybeSaveNoteSelectionAndFoldedRanges(
  note: Note,
  selection: any,
  foldedRanges: any,
): Promise<void> {
  if (selection) {
    appState.noteSelectionState.set(note.id, selection);
  }

  let meta = getMetadata();
  let noteMeta = meta.notes[note.id];
  if (!noteMeta) {
    if (!foldedRanges) {
      return;
    }
    meta.notes[note.id] = {
      foldedRanges: foldedRanges,
    };
    noteMeta = meta.notes[note.id];
  } else {
    let didChange = !objectEqualDeep(noteMeta.foldedRanges, foldedRanges);
    if (!didChange) {
      return;
    }
    noteMeta.foldedRanges = foldedRanges;
  }
  await saveAppMetadata();
}

// TODO: get all versions, encrypt, rewrite the index
export async function encryptAllNotes(pwd: string): Promise<void> {
  let pwdHash = saltPassword(pwd);
  modalInfoState.clear();
  modalInfoState.title = "Encrypting all notes";
  modalInfoState.canClose = false;
  let nEncrypted = await storeEncryptAllNotes(pwdHash);
  modalInfoState.addMessage(`Finished encrypting ${nEncrypted} versions`);
  modalInfoState.canClose = true;
  rememberPassword(pwd);
}

export async function decryptAllNotes(): Promise<void> {
  modalInfoState.clear();
  modalInfoState.title = "Decrypting all notes";
  modalInfoState.canClose = false;
  let nDecrypted = await storeDecryptAllNotes();
  modalInfoState.addMessage(`Finished decrypting ${nDecrypted} versions`);
  modalInfoState.canClose = true;
  removePassword();
}

export function isValidTab(tabStr: string): boolean {
  if (!tabStr) {
    return false;
  }
  let tab = parseTab(tabStr);
  if (tab.isURL()) {
    return true;
  }
  if (!tab.isNote()) {
    throw new Error(`Invalid tab: ${tabStr}`);
  }
  let noteName = tab.value;
  let note = findNoteByName(noteName);
  if (note) {
    return true;
  }
  return isSystemNoteName(noteName);
}

export function isValidNoteName(noteName: string): boolean {
  if (!noteName) {
    return false;
  }
  let note = findNoteByName(noteName);
  if (note) {
    return true;
  }
  return isSystemNoteName(noteName);
}
