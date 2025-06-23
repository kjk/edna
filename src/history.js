// history of opened files

import { useHeynoteStore } from "./stores/heynote-store.svelte";

let notesStore = useHeynoteStore();

const kMaxHistory = 16;

/**
 * @param {string} name
 */
export function historyPush(name) {
  console.log("historyPush:", name);
  removeNoteFromHistory(name);
  notesStore.history.unshift(name); // insert at the beginning
  if (notesStore.history.length > kMaxHistory) {
    notesStore.history.pop();
  }
}

/**
 * @param {string} oldName
 * @param {string} newName
 */
export function renameInHistory(oldName, newName) {
  let i = notesStore.history.indexOf(oldName);
  if (i >= 0) {
    notesStore.history[i] = newName;
  }
}

/**
 * @param {string} name
 */
export function removeNoteFromHistory(name) {
  let i = notesStore.history.indexOf(name);
  if (i >= 0) {
    notesStore.history.splice(i, 1);
  }
}
