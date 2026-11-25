import { noteNameFromTab } from "./constants";
import { getNoteMeta, isNoteArchived } from "./metadata";
import { getCurrentSettings, type Settings } from "./settings.svelte";

class AppState {
  /* regular, arhived, deleted notes */
  allNotes: string[] = $state([]);

  /* regular notes, not archived or deleted */
  regularNotes = $derived(this.allNotes.filter((name) => !isNoteArchived(name)));

  archivedNotes = $derived(this.allNotes.filter(isNoteArchived));

  starredNotes = $derived(this.allNotes.filter((name) => !!getNoteMeta(name)?.isStarred));
  withShortcuts = $derived(this.allNotes.filter((name) => !!getNoteMeta(name)?.altShortcut));
  noteSelectorInfoCollapsed = $state(false);

  isDirty = $state(false);

  searchRegex = $state(false);
  searchMatchCase = $state(false);
  searchMatchWholeWord = $state(false);

  searchNotesMatchCase = $state(false);
  searchNotesMatchWholeWord = $state(false);

  showingQuickAccess = $state(false);
  showingCreateNewNote = $state(false);
  showingFunctionSelector = $state(false);
  showingBlockMoveSelector = $state(false);
  showingNoteSelector = $state(false);
  showingLanguageSelector = $state(false);
  showingContextMenu = $state(false);
  showingFindInNotes = $state(false);
  showingRenameNote = $state(false);
  showingSettings = $state(false);
  showingCommandPalette = $state(false);
  showingEncryptPassword = $state(false);
  showingDecryptPassword = $state(false);
  showingAskFileWritePermissions = $state(false);
  showingAskAI = $state(false);
  showingArchived = $state(false); // show archived notes in note selector

  searchIncludeArchived = $state(false);

  history: string[] = $state([]); // names of opened notes
  get settings(): Settings {
    return getCurrentSettings();
  }

  currentNoteName: string | undefined = $derived(noteNameFromTab(this.settings.currentTab));

  forceNewTab = false;
}

export const appState = new AppState();
