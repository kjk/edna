/** @typedef {import("./login.js").UserInfo} UserInfo */

import { Note } from "./note.js";

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

  isOffline = $state(!navigator.onLine);

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
  for (let i = 0; i < appState.allNotes.length; i++) {
    if (appState.allNotes[i].id === note.id) {
      appState.allNotes.splice(i, 1);
      updateAppStateAfterNotesChange();
      break;
    }
  }
}

// TODO: maybe convert to $effect() on appState.notes
export function updateAppStateAfterNotesChange() {
  appState.regularNotes = [];
  appState.archivedNotes = [];
  appState.starredNotes = [];
  appState.withShortcuts = [];
  for (let note of appState.allNotes) {
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

$effect.root(() => {
  $effect(() => {
    const goOnline = () => (appState.isOffline = false);
    const goOffline = () => (appState.isOffline = true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  });
});

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
  let names = appState.allNotes.map((n) => n.name);
  console.warn("all notes:", names);
  return null;
}
