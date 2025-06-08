import { getNoteMeta } from "./metadata";

class AppState {
  /** @type {string[]} */
  noteNames = $state([]);
  /** @type {string[]} */
  starredNotes = $derived(calcStarred(this.noteNames)); // starred notes
  noteSelectorInfoCollapsed = $state(false);
  isDirty = $state(false);
  isDirtyFast = $state(false);
  /** @type {string[]} */
  history = $state([]); // names of opened notes
  /** @type {import("./settings.svelte").Settings} */
  settings = $state(undefined); // user settings
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
  res.sort((a, b) => a.localeCompare(b));
  return res;
}

export const appState = new AppState();
