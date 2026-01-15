import type { UserInfo } from "./login";
import { Note } from "./note";

class AppState {
  user?: UserInfo;

  /* regular, arhived, deleted notes */
  allNotes: Note[] = $state([]);

  /* regular notes, not archived or deleted */
  regularNotes: Note[] = $state([]);

  archivedNotes: Note[] = $state([]);

  starredNotes: Note[] = $state([]);
  withShortcuts: Note[] = $state([]);

  noteSelectorInfoCollapsed = $state(false);

  isDirty = $state(false);

  searchRegex = $state(false);
  searchMatchCase = $state(false);
  searchMatchWholeWord = $state(false);

  searchNotesRegex = $state(false);
  searchNotesMatchCase = $state(false);
  searchNotesMatchWholeWord = $state(false);

  showingArchived = $state(false); // show archived notes in note selector

  searchIncludeArchived = $state(false);

  history: string[] = $state([]); // names of opened notes
  settings: import("./settings.svelte").Settings = $state(undefined); // user settings

  isOnline = $state(true);

  // if true, next call to open a note will open in a new tab
  forceNewTab = false;

  //keeps editor selection / cursor state for notes
  // key is note id
  noteSelectionState: Map<string, any> = new Map();

  showingLogin = $state(false);
}

export function removeNoteFromAppState(note: Note): void {
  let allNotes = [...appState.allNotes];
  for (let i = 0; i < allNotes.length; i++) {
    if (allNotes[i].id === note.id) {
      allNotes.splice(i, 1);
      updateAppStateAfterNotesChange(allNotes);
      break;
    }
  }
}

export function updateAppStateAfterNotesChange(allNotes: Note[]): void {
  appState.allNotes = allNotes;
  appState.regularNotes = [];
  appState.archivedNotes = [];
  appState.starredNotes = [];
  appState.withShortcuts = [];
  for (let note of allNotes) {
    if (note.isArchived) {
      appState.archivedNotes.push(note);
    } else {
      appState.regularNotes.push(note);
    }
    if (note.isStarred) {
      appState.starredNotes.push(note);
    }
    if (note.altShortcut) {
      appState.withShortcuts.push(note);
    }
  }

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

export function getNotes(): Note[] {
  return appState.allNotes;
}

// set if you don't expect note to exist
export function findNoteByName(
  name: string,
  quiet: boolean = false,
): Note | null {
  for (let note of appState.allNotes) {
    if (note.name === name) {
      return note;
    }
  }
  if (quiet) {
    return null;
  }
  console.warn("findNoteByName: no note with name:", name);
  return null;
}

// set if you don't expect note to exist
export function findNoteById(id: string, quiet: boolean = false): Note | null {
  for (let note of appState.allNotes) {
    if (note.id === id) {
      return note;
    }
  }
  if (quiet) {
    return null;
  }
  console.warn("findNoteById: no note with id:", id);
  let ids = appState.allNotes.map((n) => n.id);
  console.warn("all notes:", ids);
  return null;
}
