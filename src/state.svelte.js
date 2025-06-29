import { getNoteMeta } from "./metadata";

class AppState {
  /** @type {string[]} */
  noteNames = $state([]);
  /** @type {string[]} */
  starredNotes = $derived(calcStarred(this.noteNames)); // starred notes
  /** @type {string[]} */
  withShortcuts = $derived(callcWithShortcuts(this.noteNames)); // notes with shortcuts
  noteSelectorInfoCollapsed = $state(false);

  isDirty = $state(false);

  searchRegex = $state(false);
  searchMatchCase = $state(false);
  searchMatchWholeWord = $state(false);

  searchNotesRegex = $state(false);
  searchNotesMatchCase = $state(false);
  searchNotesMatchWholeWord = $state(false);

  /** @type {string[]} */
  history = $state([]); // names of opened notes
  /** @type {import("./settings.svelte").Settings} */
  settings = $state(undefined); // user settings

  forceNewTab = false;
}

/** @returns {string[]} */
function calcStarred(noteNames) {
  /** @type {string[]} */
  let res = [];
  for (let name of noteNames) {
    let m = getNoteMeta(name, false);
    if (m && m.isStarred) {
      res.push(name);
    }
  }
  return res;
}

/** @returns {string[]} */
function callcWithShortcuts(noteNames) {
  /** @type {string[]} */
  let res = [];
  for (let name of noteNames) {
    let m = getNoteMeta(name, false);
    if (m && m.altShortcut) {
      res.push(name);
    }
  }
  return res;
}

export function updateStarred() {
  appState.starredNotes = calcStarred(appState.noteNames);
}

export function updateWithShortcuts() {
  appState.withShortcuts = callcWithShortcuts(appState.noteNames);
}

export const appState = new AppState();
