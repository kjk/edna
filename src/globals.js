import { getNotes, updateAppStateAfterNotesChange } from "./appstate.svelte";
import { Note } from "./note";
import { formatDurationShort } from "./util";

/** @typedef {{
  openSettings: () => void,
  openLanguageSelector: () => void,
  openCreateNewNote: () => void,
  openNoteSelector: () => void,
  openCommandPalette: () => void,
  openFindInNotes: () => void,
  openContextMenu: (MouseEvent) => void,
  openHistorySelector: () => void,
  createScratchNote: () => void,
  openBlockSelector: () => void,
  openFunctionSelector: (boolean) => void,
  smartRun: () => void,
  focusEditor: () => void,
  getPassword: (msg: string) => Promise<string>,
  updateAfterNoteStateChange: (notes: Note[]) => void,
  closeTabWithName: (name: string) => Promise<void>,
  reloadIfCurrent: (name: string) => Promise<void>,
}} GlobalFuncs
*/

let sessionStart = performance.now();
/**
 * @returns {string}
 */
export function getSessionDur() {
  let durMs = Math.round(performance.now() - sessionStart);
  return formatDurationShort(durMs);
}

// it's easier to make some functions from App.vue available this way
// then elaborate scheme of throwing and catching events
// could also use setContext()
/** @type {GlobalFuncs} */
let globalFunctions;

/**
 * @param {GlobalFuncs} gf
 */
export function setGlobalFuncs(gf) {
  globalFunctions = gf;
}

export function openSettings() {
  globalFunctions.openSettings();
}

export function openLanguageSelector() {
  globalFunctions.openLanguageSelector();
}

export function openCreateNewNote() {
  globalFunctions.openCreateNewNote();
}

export function openNoteSelector() {
  globalFunctions.openNoteSelector();
}

export function openCommandPalette() {
  globalFunctions.openCommandPalette();
}

export function openContextMenu(ev) {
  globalFunctions.openContextMenu(ev);
}

export function openHistorySelector() {
  globalFunctions.openHistorySelector();
}

export function createScratchNote() {
  globalFunctions.createScratchNote();
}

export function openBlockSelector() {
  globalFunctions.openBlockSelector();
}

export function openFunctionSelector(onSelection = false) {
  globalFunctions.openFunctionSelector(onSelection);
}

export function openFindInNotes() {
  globalFunctions.openFindInNotes();
}

export function smartRun() {
  globalFunctions.smartRun();
}

export function focusEditor() {
  globalFunctions.focusEditor();
}

/**
 * @param {string} name
 */
export async function closeTabWithName(name) {
  await globalFunctions.closeTabWithName(name);
}

/**
 * @param {string} name
 */
export async function reloadIfCurrent(name) {
  await globalFunctions.reloadIfCurrent(name);
}

export function updateAfterNoteStateChange(allNotes = null) {
  if (allNotes === null) {
    allNotes = getNotes();
  }
  if (!globalFunctions) {
    // is called from boot(), before App.Svelte has a chance
    // to register global functions
    updateAppStateAfterNotesChange(allNotes);
    return;
  }
  globalFunctions.updateAfterNoteStateChange(allNotes);
}

/**
 * @param {string} msg
 * @returns {Promise<string>}
 */
export async function getPasswordFromUser(msg) {
  let pwd = await globalFunctions.getPassword(msg);
  console.log("got password:", pwd);
  return pwd;
}
