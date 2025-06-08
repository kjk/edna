// history of opened files

const kMaxHistory = 16;

import { appState } from "./state.svelte";

/**
 * @param {string} name
 */
export function historyPush(name) {
  console.log("historyPush:", name);
  removeNoteFromHistory(name);
  appState.history.unshift(name); // insert at the beginning
  if (appState.history.length > kMaxHistory) {
    appState.history.pop();
  }
}

/**
 * @param {string} oldName
 * @param {string} newName
 */
export function renameInHistory(oldName, newName) {
  let i = appState.history.indexOf(oldName);
  if (i >= 0) {
    appState.history[i] = newName;
  }
}

/**
 * @param {string} name
 */
export function removeNoteFromHistory(name) {
  let i = appState.history.indexOf(name);
  if (i >= 0) {
    appState.history.splice(i, 1);
  }
}
