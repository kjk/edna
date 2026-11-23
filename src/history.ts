import { appState } from "./appstate.svelte";
import { arrayRemove, arrayReplace } from "./util";

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
  arrayReplace(appState.history, oldName, newName);
}

export function removeNoteFromHistory(name: string) {
  arrayRemove(appState.history, name);
}
