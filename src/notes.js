import { appState, findNoteByName, getNotes } from "./appstate.svelte";
import { updateAfterNoteStateChange } from "./globals";
import { removeNoteFromHistory, renameNoteInHistory } from "./history.js";
import { nanoid } from "./nanoid";
import { Note } from "./note";
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
  getInboxNote,
  getJournalNote,
  getReleaseNotes,
  getWelcomeNote,
  getWelcomeNoteDev,
} from "./system-notes";
import { len, throwIf } from "./util";

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

const kNoteIDLength = 6; // was 8 at some point
const kNoteCotentIDLength = 4;
/**
 * @returns {string}
 */
export function genRandomNoteID() {
  return nanoid(kNoteIDLength);
}

/**
 * @param {string} noteID
 * @returns {string}
 */
function makeRandomContentID(noteID) {
  return noteID + "-" + nanoid(kNoteCotentIDLength);
}

export const blockHdrPlainText = "\n∞∞∞text-a\n";
export const blockHdrMarkdown = "\n∞∞∞markdown\n";

/**
 * @param {string} name
 * @param {string} content
 * @param {Note[]} existingNotes
 * @returns {Promise<number>}
 */
export async function createIfNotExists(name, content, existingNotes) {
  if (!existingNotes) {
    existingNotes = appState.allNotes;
  }
  if (existingNotes.find((n) => n.name == name)) {
    console.log(`note ${name} already exists`);
    return 0;
  }
  await createNoteWithName(name, content);
  return 1;
}

/**
 * @param {Note[]} existingNotes
 * @returns {Promise<number>}
 */
export async function createDefaultNotes(existingNotes) {
  let isFirstRun = len(existingNotes) == 0;
  console.log(
    `isFirstRun: ${isFirstRun}, len(existingNotes): ${len(existingNotes)}`,
  );

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
  if (isFirstRun) {
    reassignNoteShortcut(kScratchNoteName, "1");
    reassignNoteShortcut(kDailyJournalNoteName, "2");
    reassignNoteShortcut(kInboxNoteName, "3");
  }
  return nCreated;
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
  let verId = makeRandomContentID(note.id);
  await storeWriteNoteContent(verId, content || "");
  note.versionIds.push(verId);
  appState.isDirty = false;
}

/**
 * @param {string} name
 * @param {string} content
 * @returns {Promise<void>}
 */
export async function createNoteWithName(name, content = null) {
  content = fixUpNoteContent(content);
  let noteId = genRandomNoteID();
  await storeCreateNote(noteId, name);
  let note = new Note(noteId, name);
  if (content) {
    let verId = makeRandomContentID(noteId);
    await storeWriteNoteContent(verId, content);
    note.versionIds.push(verId);
    console.log("created note", name);
  }
  appState.allNotes.push(note);
  updateAfterNoteStateChange();
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
    await storeWriteNoteContent(makeRandomContentID(note.id), newContent);
    return;
  }
  await createNoteWithName(name, content);
}

/**
 * creates a new scratch-${N} note
 * @returns {Promise<string>}
 */
export async function createNewScratchNote() {
  // generate a unique "scratch-${N}" note name
  let scratchNames = [];
  for (let note of appState.allNotes) {
    if (note.name.startsWith("scratch")) {
      scratchNames.push(note.name);
    }
  }
  let scratchName = pickUniqueName("scratch", scratchNames);
  await createNoteWithName(scratchName);
  return scratchName;
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
