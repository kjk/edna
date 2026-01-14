/** @typedef {import("./login").UserInfo} UserInfo */

import { Note } from "./note";

class AppState {
  /** @type {UserInfo} */
  user;

  /* regular, arhived, deleted notes */
  /** @type {Note[]} */
  allNotes = $state([]);

  /* regular notes, not archived or deleted */
  /** @type {Note[]} */
  regularNotes = $state([]);

  /** @type {Note[]} */
  archivedNotes = $state([]);

  /** @type {Note[]} */
  starredNotes = $state([]);
  /** @type {Note[]} */
  withShortcuts = $state([]);

  noteSelectorInfoCollapsed = $state(false);

  isDirty = $state(false);

  searchRegex = $state(false);
  searchMatchCase = $state(false);
  searchMatchWholeWord = $state(false);

  searchNotesRegex = $state(false);
  searchNotesMatchCase = $state(false);
  searchNotesMatchWholeWord = $state(false);

  showingArchived = $state(false); // show archived notes in note selector

  searchIncludeArchived = $state(false);

  /** @type {string[]} */
  history = $state([]); // names of opened notes
  /** @type {import("./settings.svelte").Settings} */
  settings = $state(undefined); // user settings

  isOnline = $state(true);

  // if true, next call to open a note will open in a new tab
  forceNewTab = false;

  //keeps editor selection / cursor state for notes
  // key is note id
  /** @type {Map<string, any>} */
  noteSelectionState = new Map();

  showingLogin = $state(false);
}

/**
 * @param {Note} note
 */
export function removeNoteFromAppState(note) {
  let allNotes = [...appState.allNotes];
  for (let i = 0; i < allNotes.length; i++) {
    if (allNotes[i].id === note.id) {
      allNotes.splice(i, 1);
      updateAppStateAfterNotesChange(allNotes);
      break;
    }
  }
}

/**
 * @param {Note[]} allNotes
 */
export function updateAppStateAfterNotesChange(allNotes) {
  appState.allNotes = allNotes;
  appState.regularNotes = [];
  appState.archivedNotes = [];
  appState.starredNotes = [];
  appState.withShortcuts = [];
  for (let note of allNotes) {
    if (note.isArchived) {
      appState.archivedNotes.push(note);
    } else {
      appState.regularNotes.push(note);
    }
    if (note.isStarred) {
      appState.starredNotes.push(note);
    }
    if (note.altShortcut) {
      appState.withShortcuts.push(note);
    }
  }

  // console.log(
  //   "appStateUpdateAfterNotesChange: regular:",
  //   appState.regularNotes.length,
  //   "archived:",
  //   appState.archivedNotes.length,
  //   "deleted:",
  //   appState.deletedNotes.length,
  //   "starred:",
  //   appState.starredNotes.length,
  //   "withShortcuts:",
  //   appState.withShortcuts.length,
  // );
}

export const appState = new AppState();

export function getNotes() {
  return appState.allNotes;
}

/**
 * @param {string} name
 * @param {boolean} [quiet=false] set if you don't expect note to exist
 * @returns {Note|null}
 */
export function findNoteByName(name, quiet = false) {
  for (let note of appState.allNotes) {
    if (note.name === name) {
      return note;
    }
  }
  if (quiet) {
    return null;
  }
  console.warn("findNoteByName: no note with name:", name);
  return null;
}

/**
 * @param {string} id
 * @param {boolean} [quiet=false] set if you don't expect note to exist
 * @returns {Note|null}
 */
export function findNoteById(id, quiet = false) {
  for (let note of appState.allNotes) {
    if (note.id === id) {
      return note;
    }
  }
  if (quiet) {
    return null;
  }
  console.warn("findNoteById: no note with id:", id);
  let ids = appState.allNotes.map((n) => n.id);
  console.warn("all notes:", ids);
  return null;
}
