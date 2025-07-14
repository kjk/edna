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

  forceNewTab = false;

  isOffline = $state(!navigator.onLine);
}

// TODO: maybe convert to $effect() on appState.notes
export function appStateUpdateAfterNotesChange() {
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
 * @returns {Note}
 */
export function findNoteByName(name) {
  for (let note of appState.allNotes) {
    if (note.name === name) {
      return note;
    }
  }
  console.warn("findNoteByName: no note with name:", name);
  let names = appState.allNotes.map((n) => n.name);
  console.warn("all notes:", names);
  return null;
}
