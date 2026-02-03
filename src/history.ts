import { appState } from "./appstate.svelte";

// history of opened files

const kMaxHistory = 16;

export function addNoteToHistory(name: string) {
  // console.log("historyPush:", name);
  removeNoteFromHistory(name);
  appState.history.unshift(name); // insert at the beginning
  if (appState.history.length > kMaxHistory) {
    appState.history.pop();
  }
}

export function renameNoteInHistory(oldName: string, newName: string) {
  let i = appState.history.indexOf(oldName);
  if (i >= 0) {
    appState.history[i] = newName;
  }
}

export function removeNoteFromHistory(name: string) {
  let i = appState.history.indexOf(name);
  if (i >= 0) {
    appState.history.splice(i, 1);
  }
}
