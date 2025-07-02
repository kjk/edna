import { getNoteMeta } from "./metadata";

class AppState {
  /* regular, arhived, deleted notes */
  /** @type {string[]} */
  allNotes = $state([]);

  /* regular notes, not archived or deleted */
  /** @type {string[]} */
  regularNotes = $derived(calcRegular(this.allNotes));

  /** @type {string[]} */
  trashedNotes = $derived(calcDeleted(this.allNotes));

  /** @type {string[]} */
  archivedNotes = $derived(calcArchived(this.allNotes));

  /** @type {string[]} */
  starredNotes = $derived(calcStarred(this.allNotes)); // starred notes
  /** @type {string[]} */
  withShortcuts = $derived(callcWithShortcuts(this.allNotes)); // notes with shortcuts
  noteSelectorInfoCollapsed = $state(false);

  isDirty = $state(false);

  searchRegex = $state(false);
  searchMatchCase = $state(false);
  searchMatchWholeWord = $state(false);

  searchNotesRegex = $state(false);
  searchNotesMatchCase = $state(false);
  searchNotesMatchWholeWord = $state(false);

  showingArchived = $state(false); // show archived notes in note selector
  showingTrashed = $state(false); // show deleted notes in note selector

  searchIncludeArchived = $state(false);
  searchIncludeTrashed = $state(false);

  /** @type {string[]} */
  history = $state([]); // names of opened notes
  /** @type {import("./settings.svelte").Settings} */
  settings = $state(undefined); // user settings

  forceNewTab = false;
}

/**
 * @param {string[]} noteNames
 * @returns {string[]}
 */
function calcRegular(noteNames) {
  /** @type {string[]} */
  let res = [];
  for (let name of noteNames) {
    let m = getNoteMeta(name, false);
    if (m && (m.isArchived || m.isTrashed)) {
      continue;
    }
    res.push(name);
  }
  return res;
}

/** @returns {string[]} */
function calcWithBoolKey(noteNames, key) {
  /** @type {string[]} */
  let res = [];
  for (let name of noteNames) {
    let m = getNoteMeta(name, false);
    if (m && m[key]) {
      res.push(name);
    }
  }
  return res;
}

/** @returns {string[]} */
function calcStarred(noteNames) {
  return calcWithBoolKey(noteNames, "isStarred");
}

/** @returns {string[]} */
function calcArchived(noteNames) {
  return calcWithBoolKey(noteNames, "isArchived");
}

/** @returns {string[]} */
function calcDeleted(noteNames) {
  return calcWithBoolKey(noteNames, "isTrashed");
}

/** @returns {string[]} */
function callcWithShortcuts(noteNames) {
  // altShortcut is string not bool but it still works
  return calcWithBoolKey(noteNames, "altShortcut");
}

export function appStateUpdateAfterNotesChange() {
  let all = appState.allNotes;
  appState.regularNotes = calcRegular(all);
  appState.archivedNotes = calcArchived(all);
  appState.trashedNotes = calcDeleted(all);
  appState.starredNotes = calcStarred(all);
  appState.withShortcuts = callcWithShortcuts(all);
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
