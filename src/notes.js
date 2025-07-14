import { appState, findNoteByName, getNotes } from "./appstate.svelte";
import { updateAfterNoteStateChange } from "./globals";
import { removeNoteFromHistory, renameNoteInHistory } from "./history.js";
import { getMetadata, saveAppMetadata } from "./metadata";
import { mkRandomContentId, mkRandomNoteId, Note } from "./note";
import { getSettings } from "./settings.svelte";
import {
  storeCreateNote,
  storeDeleteNote,
  storeLoadLatestNoteContent,
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
import { len, objectEqualDeep, throwIf } from "./util";

const kLSPassowrdKey = "elaris-password";

/**
 * @param {string} pwd
 */
function rememberPassword(pwd) {
  localStorage.setItem(kLSPassowrdKey, pwd);
}

function removePassword() {
  localStorage.removeItem(kLSPassowrdKey);
}

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

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isSystemNoteName(name) {
  return systemNotes.includes(name);
}

export const blockHdrPlainText = "\n∞∞∞text-a\n";
export const blockHdrMarkdown = "\n∞∞∞markdown\n";

/**
 * @param {string} name
 * @param {string} content
 * @param {Note[]} existingNotes
 * @returns {Promise<boolean>}
 */
export async function createIfNotExists(name, content, existingNotes) {
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

export async function saveNote(name, content) {
  console.log("note name:", name);
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

/**
 * returns note id
 * @param {string} name
 * @param {string} content
 * @returns {Promise<string>}
 */
export async function createNoteWithName(name, content = null) {
  content = fixUpNoteContent(content);
  let noteId = mkRandomNoteId();
  await storeCreateNote(noteId, name);
  let note = new Note(noteId, name);
  if (content) {
    let verId = mkRandomContentId(noteId);
    await storeWriteNoteContent(verId, content);
    note.versionIds.push(verId);
    console.log("created note", name);
  }
  appState.allNotes.push(note);
  updateAfterNoteStateChange();
  return note.id;
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
  let note = findNoteByName(name);
  if (note) {
    let currContent = await loadNoteContent(name);
    let newContent = currContent + content;
    await storeWriteNoteContent(mkRandomContentId(note.id), newContent);
    return;
  }
  await createNoteWithName(name, content);
}

/**
 * creates a new ${name}<-${N}> note
 * @param {string} name
 * @param {string?} content
 * @returns {Promise<string>}
 */
export async function createNoteWithUniqueName(name, content = null) {
  let names = [];
  for (let note of appState.allNotes) {
    if (note.name.startsWith(name)) {
      names.push(note.name);
    }
  }
  let newName = pickUniqueName(name, names);
  await createNoteWithName(newName);
  return newName;
}

/**
 * creates a new scratch-${N} note
 * @returns {Promise<string>}
 */
export async function createUniqueScratchNote() {
  return await createNoteWithUniqueName(kScratchNoteName);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function noteExists(name) {
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

/**
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function loadNoteContentIfExists(name) {
  if (!noteExists(name)) {
    return null;
  }
  return await loadNoteContent(name);
}

/**
 * returns null if can't read the note
 * @param {string} name
 * @returns {Promise<string>}
 */
export async function loadNoteContent(name) {
  // console.log("loadNote:", name);
  let res;
  if (isSystemNoteName(name)) {
    res = getSystemNoteContent(name);
    return res;
  }
  let note = findNoteByName(name);
  res = await storeLoadLatestNoteContent(note.id);
  return fixUpNoteContent(res);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function canDeleteNote(name) {
  if (name === kScratchNoteName) {
    return false;
  }
  return !isSystemNoteName(name);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isNoteTrashable(name) {
  if (name === kScratchNoteName) {
    return false;
  }
  return !isSystemNoteName(name);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isNoteArchivable(name) {
  return isNoteTrashable(name);
}

/**
 * @param {string} name
 */
export async function deleteNote(name) {
  let note = findNoteByName(name);
  storeDeleteNote(note.id);
  removeNoteFromHistory(name);
}

/**
 * @param {string} oldName
 * @param {string} newName
 * @param {string} content
 */
export async function renameNote(oldName, newName, content) {
  let note = findNoteByName(oldName);
  note.name = newName;
  await saveNoteMetadata(note);
  renameNoteInHistory(oldName, newName);
  let settings = getSettings();
  let idx = settings.tabs.indexOf(oldName);
  if (idx >= 0) {
    settings.tabs[idx] = newName;
  }
  await deleteNote(oldName);
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
  return len(appState.allNotes);
}

/**
 * @param {string} name
 * @param {string} altShortcut - "0" ... "9"
 */
export async function reassignNoteShortcut(name, altShortcut) {
  console.log("reassignNoteShortcut:", name, altShortcut);
  let notes = getNotes();
  for (let note of notes) {
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
  updateAfterNoteStateChange();
}

/**
 * @param {string} name
 */
export async function archiveNote(name) {
  let note = findNoteByName(name);
  note.isArchived = true;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
}

/**
 * @param {string} name
 */
export async function unArchiveNote(name) {
  let note = findNoteByName(name);
  note.isArchived = false;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
}

/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function toggleNoteStarred(name) {
  let note = findNoteByName(name);
  note.isStarred = !note.isStarred;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
  return note.isStarred;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isNoteArchived(name) {
  let note = findNoteByName(name);
  return note ? note.isArchived : false;
}

/**
 * @param {Note} note
 */
export async function saveNoteMetadata(note) {
  let m = note.getMetadata();
  console.log("saveNoteMetadata:", m);
  await storeWriteNoteMeta(m);
}

export async function maybeSaveNoteSelectionAndFoldedRanges(
  note,
  selection,
  foldedRanges,
) {
  let meta = getMetadata();
  let noteMeta = meta.notes[note.id];
  if (!noteMeta) {
    meta.notes[note.id] = {};
    noteMeta = meta.notes[note.id];
  }
  let didChange = false;
  if (foldedRanges && !objectEqualDeep(noteMeta.foldedRanges, foldedRanges)) {
    didChange = true;
    noteMeta.foldedRanges = foldedRanges;
  }
  if (selection && !objectEqualDeep(noteMeta.selection, selection)) {
    didChange = true;
    noteMeta.selection = selection;
  }
  if (!didChange) {
    // console.log("saveFoldedState: skipping save, no changes");
    return;
  }
  // console.log(
  //   "saveFoldedState: saving selection:",
  //   meta.selection,
  //   "folededState:",
  //   foldedRanges,
  // );
  await saveAppMetadata();
}
