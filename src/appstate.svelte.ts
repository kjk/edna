import { getNoteMeta } from "./metadata";
import { defaultSettings, type Settings } from "./settings.svelte";

class AppState {
  /* regular, arhived, deleted notes */
  allNotes: string[] = $state([]);

  /* regular notes, not archived or deleted */
  regularNotes: string[] = $derived(calcRegular(this.allNotes));

  archivedNotes: string[] = $derived(calcArchived(this.allNotes));

  starredNotes: string[] = $derived(calcStarred(this.allNotes)); // starred notes
  withShortcuts: string[] = $derived(callcWithShortcuts(this.allNotes)); // notes with shortcuts
  noteSelectorInfoCollapsed = $state(false);

  isDirty = $state(false);

  searchRegex = $state(false);
  searchMatchCase = $state(false);
  searchMatchWholeWord = $state(false);

  searchNotesRegex = $state(false);
  searchNotesMatchCase = $state(false);
  searchNotesMatchWholeWord = $state(false);

  showingQuickAccess = $state(false);
  showingCreateNewNote = $state(false);
  showingArchived = $state(false); // show archived notes in note selector

  searchIncludeArchived = $state(false);

  history: string[] = $state([]); // names of opened notes
  settings: Settings = $state(defaultSettings); // user settings

  forceNewTab = false;
}

function calcRegular(noteNames: string[]): string[] {
  let res: string[] = [];
  for (let name of noteNames) {
    let m = getNoteMeta(name, false);
    if (m && m.isArchived) {
      continue;
    }
    res.push(name);
  }
  return res;
}

function calcWithBoolKey(noteNames: string[], key: string): string[] {
  let res: string[] = [];
  for (let name of noteNames) {
    let m = getNoteMeta(name, false);
    // @ts-ignore
    if (m && m[key]) {
      res.push(name);
    }
  }
  return res;
}

function calcStarred(noteNames: string[]): string[] {
  return calcWithBoolKey(noteNames, "isStarred");
}

function calcArchived(noteNames: string[]): string[] {
  return calcWithBoolKey(noteNames, "isArchived");
}

function callcWithShortcuts(noteNames: string[]): string[] {
  // altShortcut is string not bool but it still works
  return calcWithBoolKey(noteNames, "altShortcut");
}

export function appStateUpdateAfterNotesChange() {
  let all = appState.allNotes;
  appState.regularNotes = calcRegular(all);
  appState.archivedNotes = calcArchived(all);
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
