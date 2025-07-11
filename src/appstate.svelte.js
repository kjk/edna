function toUndef(v) {
  if (!v) {
    return undefined;
  }
}

export class Note {
  /** @type {string} */
  id;
  /** @type {string} */
  name;
  /** @type {string[]} */
  versionIds;
  /** @type {boolean} */
  isArchived = false;
  /** @type {boolean} */
  isStarred = false;
  /** @type {string}  */
  altShortcut = undefined;

  getMetadata() {
    // by using toUndef() we make JSON-serialized version
    // smaller and easier to read
    return $state.snapshot({
      id: this.id,
      name: this.name,
      isArchived: toUndef(this.isArchived),
      isStarred: toUndef(this.isStarred),
      altShortcut: toUndef(this.altShortcut),
    });
  }

  constructor() {}
}

class AppState {
  /* regular, arhived, deleted notes */
  /** @type {Note[]} */
  allNotes = $state([]);

  /* regular notes, not archived or deleted */
  /** @type {Note[]} */
  regularNotes = $state([]);

  /** @type {Note[]} */
  archivedNotes = $state([]);

  /** @type {Note[]} */
  starredNotes = $state([]);
  /** @type {Note[]} */
  withShortcuts = $state([]);

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

  /** @type {string[]} */
  history = $state([]); // names of opened notes
  /** @type {import("./settings.svelte").Settings} */
  settings = $state(undefined); // user settings

  forceNewTab = false;
}

// TODO: maybe convert to $effect() on appState.notes
export function appStateUpdateAfterNotesChange() {
  appState.regularNotes = [];
  appState.archivedNotes = [];
  appState.starredNotes = [];
  appState.withShortcuts = [];
  for (let note of appState.allNotes) {
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
export function getNotes() {
  return appState.allNotes;
}

/**
 * @param {string} name
 * @returns {Note}
 */
export function findNoteByName(name) {
  return appState.allNotes.find((n) => n.name === name);
}
