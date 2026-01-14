import { getNotes, updateAppStateAfterNotesChange } from "./appstate.svelte";
import { Note } from "./note";
import { formatDurationShort } from "./util";

export type GlobalFuncs = {
  openSettings: () => void;
  openLanguageSelector: () => void;
  openCreateNewNote: () => void;
  openNoteSelector: () => void;
  openCommandPalette: () => void;
  openFindInNotes: () => void;
  openContextMenu: (ev: MouseEvent) => void;
  openQuickAccess: () => void;
  createScratchNote: () => void;
  openBlockSelector: () => void;
  openFunctionSelector: (onSelection: boolean) => void;
  smartRun: () => void;
  focusEditor: () => void;
  getPassword: (msg: string) => Promise<string>;
  updateAfterNoteStateChange: (notes: Note[]) => void;
  closeTabWithName: (name: string) => Promise<void>;
  reloadIfCurrent: (name: string) => Promise<void>;
};

let sessionStart = performance.now();

export function getSessionDur(): string {
  let durMs = Math.round(performance.now() - sessionStart);
  return formatDurationShort(durMs);
}

// it's easier to make some functions from App.vue available this way
// then elaborate scheme of throwing and catching events
// could also use setContext()
let globalFunctions: GlobalFuncs;

export function setGlobalFuncs(gf: GlobalFuncs): void {
  globalFunctions = gf;
}

export function openSettings(): void {
  globalFunctions.openSettings();
}

export function openLanguageSelector(): void {
  globalFunctions.openLanguageSelector();
}

export function openCreateNewNote(): void {
  globalFunctions.openCreateNewNote();
}

export function openNoteSelector(): void {
  globalFunctions.openNoteSelector();
}

export function openCommandPalette(): void {
  globalFunctions.openCommandPalette();
}

export function openContextMenu(ev: MouseEvent): void {
  globalFunctions.openContextMenu(ev);
}

export function openQuickAccess(): void {
  globalFunctions.openQuickAccess();
}

export function createScratchNote(): void {
  globalFunctions.createScratchNote();
}

export function openBlockSelector(): void {
  globalFunctions.openBlockSelector();
}

export function openFunctionSelector(onSelection: boolean = false): void {
  globalFunctions.openFunctionSelector(onSelection);
}

export function openFindInNotes(): void {
  globalFunctions.openFindInNotes();
}

export function smartRun(): void {
  globalFunctions.smartRun();
}

export function focusEditor(): void {
  globalFunctions.focusEditor();
}

export async function closeTabWithName(name: string): Promise<void> {
  await globalFunctions.closeTabWithName(name);
}

export async function reloadIfCurrent(name: string): Promise<void> {
  await globalFunctions.reloadIfCurrent(name);
}

export function updateAfterNoteStateChange(allNotes: Note[] | null = null): void {
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

export async function getPasswordFromUser(msg: string): Promise<string> {
  let pwd = await globalFunctions.getPassword(msg);
  console.log("got password:", pwd);
  return pwd;
}
