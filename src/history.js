// history of opened files

const kMaxHistory = 16;

import { openedHistory } from "./state.svelte";

/**
 * @param {string} name
 */
export function historyPush(name) {
  console.log("historyPush:", name);
  removeNoteFromHistory(name);
  openedHistory.unshift(name); // insert at the beginning
  if (openedHistory.length > kMaxHistory) {
    openedHistory.pop();
  }
}

/**
 * @param {string} oldName
 * @param {string} newName
 */
export function renameInHistory(oldName, newName) {
  let i = openedHistory.indexOf(oldName);
  if (i >= 0) {
    openedHistory[i] = newName;
  }
}

/**
 * @param {string} name
 */
export function removeNoteFromHistory(name) {
  let i = openedHistory.indexOf(name);
  if (i >= 0) {
    openedHistory.splice(i, 1);
  }
}
