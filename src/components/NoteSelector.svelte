<script module lang="ts">
  export interface NoteInfo {
    key: number;
    name: string;
    nameLC: string;
    isStarred: boolean;
    isArchived: boolean;
    altShortcut?: number; // if present, 1 to 9 for Alt-1 to Alt-9
  }

  /**
   * -1 if a < b
   * 0 if a = b
   * 1 if a > b
   */
  export function sortNotes(a: NoteInfo, b: NoteInfo): number {
    // first archived
    if (a.isArchived && !b.isArchived) {
      return -1;
    }
    if (!a.isArchived && b.isArchived) {
      return 1;
    }
    // then those with Alt shortcut
    if (a.altShortcut && !b.altShortcut) {
      return -1;
    }
    // without shortcut are after (>) those with
    if (!a.altShortcut && b.altShortcut) {
      return 1;
    }
    // if both have shortcut, sort by shortcut
    if (a.altShortcut && b.altShortcut) {
      return a.altShortcut - b.altShortcut;
    }
    // then starred
    if (a.isStarred && !b.isStarred) {
      return -1;
    }
    if (!a.isStarred && b.isStarred) {
      return 1;
    }

    let isSysA = isSystemNoteName(a.name);
    let isSysB = isSystemNoteName(b.name);
    // system are last
    if (isSysA && !isSysB) {
      return 1;
    }
    if (!isSysA && isSysB) {
      return -1;
    }
    // if both have no shortcut, sort by name
    return a.name.localeCompare(b.name);
  }

  let lastKey = 0;

  export function buildNoteInfo(name: string): NoteInfo {
    let isArchived = false;
    let isStarred = false;
    let m = getNoteMeta(name, false);
    if (m) {
      isStarred = !!m.isStarred;
      isArchived = !!m.isArchived;
    }
    let item: NoteInfo = {
      key: lastKey,
      name: name,
      nameLC: name.toLowerCase(),
      isStarred: isStarred,
      isArchived: isArchived,
    };
    lastKey++;
    let n = parseInt(m?.altShortcut || "0");
    if (n >= 1 && n <= 9) {
      item.altShortcut = n;
    }
    return item;
  }

  export function buildNoteInfos(noteNames: string[]): NoteInfo[] {
    // console.log("buildItems, notes", noteInfos)
    let res: NoteInfo[] = Array(len(noteNames));
    for (let i = 0; i < len(noteNames); i++) {
      let name = noteNames[i]!;
      let item = buildNoteInfo(name);
      res[i] = item;
    }
    res.sort(sortNotes);
    return res;
  }

  // regular notes and, optionally, archived notes
  export function buildRegularAndArchivedNoteInfos(regular: string[], archived: string[]): NoteInfo[] {
    return buildNoteInfos([...regular, ...archived]);
  }

  // regular notes (current note list by default) and, if showing them, archived notes
  export function buildVisibleNoteInfos(regular: string[] = appState.regularNotes): NoteInfo[] {
    return buildRegularAndArchivedNoteInfos(regular, appState.showingArchived ? appState.archivedNotes : []);
  }

  // e.g. "Alt + 1" or "" if no shortcut
  export function noteShortcutStr(note: NoteInfo): string {
    return note.altShortcut ? getAltChar() + " + " + note.altShortcut : "";
  }

  // e.g. "12 notes" or "3 of 12 notes"
  export function notesCountMsg(nFiltered: number, nTotal: number): string {
    if (nFiltered === 0) {
      return ""; // don't obscure user entering new, long note name
    }
    if (nFiltered === nTotal) {
      return `${nTotal} notes`;
    }
    return `${nFiltered} of ${nTotal} notes`;
  }

  // system and archived notes are shown in italic
  export function noteNameCls(name: string): string {
    let m = getNoteMeta(name);
    let isArchived = m && m.isArchived;
    if (isSystemNoteName(name) || isArchived) {
      return "italic";
    }
    return "";
  }

  export interface NoteSelectorActions {
    canOpenSelected: boolean;
    canCreate: boolean;
    canCreateWithEnter: boolean;
    canDeleteSelected: boolean;
  }

  // what the user can do given selected note and (sanitized) note name typed in filter
  export function noteSelectorActions(selected: NoteInfo | undefined, name: string): NoteSelectorActions {
    let canOpenSelected = !!selected;
    // check all notes, not just visible ones (archived notes might be hidden)
    // to not overwrite an existing note (N-I1)
    let canCreate = len(name) > 0 && !findNoteIgnoreCase(name) && !noteNameError(name);
    // if nothing is selected, we can create with just Enter
    // otherwise we need Ctrl + Enter
    let canCreateWithEnter = canCreate && !canOpenSelected;
    // can't delete scratch note or system notes
    let canDeleteSelected = !!selected && selected.name !== kScratchNoteName && !isSystemNoteName(selected.name);
    return { canOpenSelected, canCreate, canCreateWithEnter, canDeleteSelected };
  }

  // note: UI is updated via updateAfterNoteStateChange() after metadata is saved
  export async function toggleStarredAndFocus(noteInfo: NoteInfo, focusEl?: HTMLElement) {
    await toggleNoteStarred(noteInfo.name);
    focusEl?.focus();
  }

  export interface NoteSelectorCallbacks {
    openNote: (name: string, newTab: boolean) => void;
    // creating and deleting are optional; without them Enter only opens the selected note
    createNote?: (name: string) => void;
    deleteNote?: (name: string, showNotif: boolean) => void;
  }

  const kNoActions: NoteSelectorActions = {
    canOpenSelected: false,
    canCreate: false,
    canCreateWithEnter: false,
    canDeleteSelected: false,
  };

  // filter text, matching notes and the selected note, shared by note selectors
  // must be created during component initialization
  export class NoteFilter {
    private getNoteInfos: () => NoteInfo[];
    private onCommandPrefix?: () => void;
    private getCallbacks: () => NoteSelectorCallbacks;
    // filter <input>, bind with bind:this so that it gets focus back after toggling starred
    input: HTMLInputElement | undefined;

    filter = $state("");
    hiliRegExp = $derived(makeHilightRegExp(this.filter));
    sanitizedFilter = $derived(sanitizeNoteName(this.filter));
    noteInfos: NoteInfo[] = $derived.by(() => this.getNoteInfos());
    // we split the search term by space, the name of the note must match all parts
    filtered: NoteInfo[] = $derived(
      this.isCommand() ? [] : findMatchingItems(this.noteInfos, this.sanitizedFilter, "nameLC"),
    );
    countMsg = $derived(notesCountMsg(len(this.filtered), len(this.noteInfos)));

    selected: NoteInfo | undefined = $state();
    selectedName = $derived(this.selected ? this.selected.name : "");
    actions: NoteSelectorActions = $state(kNoActions);
    // key that creates a note named after the filter
    createKey = $derived(this.actions.canCreateWithEnter ? "Enter" : "Ctrl + Enter");

    // onCommandPrefix, if given, is called when the user types ">" to switch to command palette
    constructor(
      getNoteInfos: () => NoteInfo[],
      getCallbacks: () => NoteSelectorCallbacks,
      onCommandPrefix?: () => void,
    ) {
      this.getNoteInfos = getNoteInfos;
      this.getCallbacks = getCallbacks;
      this.onCommandPrefix = onCommandPrefix;
      if (onCommandPrefix) {
        // note: must be in $effect because it modifies state, which is not allowed in $derived
        $effect(() => {
          if (this.isCommand()) {
            onCommandPrefix();
          }
        });
      }
    }

    private isCommand(): boolean {
      return !!this.onCommandPrefix && this.sanitizedFilter.startsWith(">");
    }

    // pass as ListBox selectionChanged
    selectionChanged = (item: NoteInfo | undefined, idx: number) => {
      this.selected = item;
      this.actions = noteSelectorActions(item, this.sanitizedFilter);
    };

    openNote = (noteInfo: NoteInfo, newTab: boolean) => {
      this.getCallbacks().openNote(noteInfo.name, newTab);
    };

    toggleStarred = (noteInfo: NoteInfo) => {
      toggleStarredAndFocus(noteInfo, this.input);
    };

    // keyboard shortcuts shared by note selectors:
    // Alt + 1...9 assigns quick access shortcut, Alt + S toggles starred,
    // Enter opens selected or creates note, Ctrl + Delete deletes selected note
    // Returns true if the event was handled
    handleKeydown(ev: KeyboardEvent): boolean {
      let selected = this.selected;
      let altN = isAltNumEvent(ev);
      if (altN !== null) {
        ev.preventDefault();
        if (selected) {
          reassignNoteShortcut(selected.name, altN);
          return true;
        }
      }
      let key = ev.key;
      if (key === "s" && ev.altKey && selected) {
        ev.preventDefault();
        this.toggleStarred(selected);
        return true;
      }

      let { createNote, deleteNote } = this.getCallbacks();
      if (key === "Enter") {
        ev.preventDefault();
        let actions = this.actions;
        if (createNote && (actions.canCreateWithEnter || (ev.ctrlKey && actions.canCreate))) {
          createNote(this.sanitizedFilter);
          return true;
        }
        if (selected) {
          this.openNote(selected, false);
        }
        return true;
      }

      if (deleteNote && isKeyCtrlDelete(ev)) {
        ev.preventDefault();
        if (this.actions.canDeleteSelected && selected) {
          deleteNote(selected.name, false);
        }
        return true;
      }
      return false;
    }
  }

  export { noteStarButton, noteFilterInput, noteItemRow };
</script>

<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import {
    archiveNote,
    getNoteMeta,
    isNoteArchived,
    reassignNoteShortcut,
    toggleNoteStarred,
    unArchiveNote,
  } from "../metadata";
  import { kScratchNoteName } from "../constants";
  import { findNoteIgnoreCase, isNoteArchivable, isSystemNoteName, sanitizeNoteName } from "../notes";
  import { noteNameError } from "../note-name";
  import {
    findMatchingItems,
    getAltChar,
    hilightText,
    isAltNumEvent,
    isKeyCtrlDelete,
    len,
    makeHilightRegExp,
    noOp,
  } from "../util";
  import { IconTablerArchive, IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  interface Props {
    header?: string;
    openNote: (name: string, newTab: boolean) => void;
    createNote: (name: string) => void;
    deleteNote: (name: string, showNotif: boolean) => Promise<void>;
    switchToCommandPalette?: () => void;
    switchToWideNoteSelector?: () => void;
    forMoveBlock?: boolean;
  }
  let {
    header = undefined,
    openNote,
    createNote,
    deleteNote,
    switchToCommandPalette = noOp,
    switchToWideNoteSelector = noOp,
    forMoveBlock = false,
  }: Props = $props();

  const nf = new NoteFilter(
    () =>
      buildVisibleNoteInfos(
        // can't move a block to the note it's in
        forMoveBlock ? appState.regularNotes.filter((n) => n !== appState.currentNoteName) : appState.regularNotes,
      ),
    () => ({ openNote, createNote, deleteNote }),
    () => switchToCommandPalette(),
  );
  let altChar = getAltChar();

  function onKeydown(ev: KeyboardEvent) {
    if (nf.handleKeydown(ev)) {
      return;
    }
    listboxRef?.onkeydown(ev, nf.filter === "");
  }

  function toggleInfoPanelCollapsed() {
    appState.noteSelectorInfoCollapsed = !appState.noteSelectorInfoCollapsed;
  }

  let listboxRef: ListBox;

  function toggleShowArchived() {
    appState.showingArchived = !appState.showingArchived;
  }
  function showHideTxt(isShowing: boolean) {
    return isShowing ? "hide" : "show";
  }
</script>

{#snippet noteStarButton(noteInfo: NoteInfo, toggleStarred: (noteInfo: NoteInfo) => void, cls: string)}
  <button
    tabindex="-1"
    class="{cls} cursor-pointer hover:text-yellow-600"
    onclick={(ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleStarred(noteInfo);
    }}
  >
    {@render IconTablerStar(noteInfo.isStarred ? "var(--color-yellow-300)" : "none")}
  </button>
{/snippet}

<!-- filter <input> with "n of m notes" count -->
{#snippet noteFilterInput(nf: NoteFilter)}
  <div class="relative">
    <input
      use:focus
      bind:this={nf.input}
      bind:value={nf.filter}
      type="text"
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-2 top-1 italic text-gray-400">
      {nf.countMsg}
    </div>
  </div>
{/snippet}

<!-- star button, highlighted name and shortcut of a note in ListBox -->
{#snippet noteItemRow(noteInfo: NoteInfo, nf: NoteFilter, nameCls: string)}
  {@const hili = hilightText(noteInfo.name, nf.hiliRegExp)}
  {@render noteStarButton(noteInfo, nf.toggleStarred, "-ml-1.5")}
  <div class="ml-2 truncate {nameCls}">
    {@html hili}
  </div>
  <div class="grow"></div>
  <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">
    {noteShortcutStr(noteInfo)}
  </div>
{/snippet}

{#snippet showArchived()}
  {#if len(appState.archivedNotes)}
    <div
      class="flex justify-around text-gray-700 text-sm max-w-full dark:text-white/50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
    >
      {#if len(appState.archivedNotes) > 0}
        <button
          onclick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            toggleShowArchived();
          }}
          class="link"
        >
          {showHideTxt(appState.showingArchived)}
          {len(appState.archivedNotes)} archived
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet shortHelp()}
  <div
    class="flex justify-between text-gray-700 text-xs max-w-full dark:text-white/50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
  >
    <button
      onclick={(ev) => {
        ev.preventDefault();
        switchToCommandPalette();
      }}
      class="link">command palette</button
    >
    <button
      onclick={(ev) => {
        ev.preventDefault();
        switchToWideNoteSelector();
      }}
      title="switch to wide note dlg"
      class="link">wide</button
    >
    <button
      onclick={(ev) => {
        ev.preventDefault();
        toggleInfoPanelCollapsed();
      }}
      title="show help"
      class="link"
    >
      show help</button
    >
  </div>
{/snippet}

{#snippet longHelp()}
  <div class="dlg-info">
    <div class="flex flex-col items-right absolute bottom-3 right-4">
      <button
        onclick={(ev) => {
          ev.preventDefault();
          switchToWideNoteSelector();
        }}
        title="switch to wide note dlg"
        class="link mb-1 text-right">wide</button
      >
      <button
        onclick={(ev) => {
          ev.preventDefault();
          toggleInfoPanelCollapsed();
        }}
        title="hide help"
        class="link"
      >
        hide help</button
      >
    </div>
    {#if nf.actions.canOpenSelected}
      <div class="kbd">Enter</div>
      <div class="truncate">
        open note <span class="font-bold">
          {nf.selectedName}
        </span>
      </div>
    {/if}

    {#if nf.actions.canCreate}
      <div class="kbd">{nf.createKey}</div>
      <div class="truncate">
        create note <span class="font-bold">
          {nf.filter}
        </span>
      </div>
    {/if}

    {#if nf.actions.canOpenSelected && nf.actions.canDeleteSelected}
      <div class="kbd">Ctrl + Delete</div>
      <div class="red truncate">
        delete note <span class="font-bold">
          {nf.selectedName}
        </span>
      </div>
    {/if}

    {#if nf.actions.canOpenSelected && !nf.actions.canDeleteSelected}
      <div class="kbd">Ctrl + Delete</div>
      <div class="red truncate">
        can't trash <span class="font-bold">{nf.selectedName}</span>
      </div>
    {/if}

    {#if nf.actions.canOpenSelected}
      <div class="kbd">{altChar} + 1...9</div>
      <div>assign quick access shortcut</div>
    {/if}

    {#if nf.actions.canOpenSelected}
      <div class="kbd">{altChar} + S</div>
      <div>toggle favorite</div>
    {/if}

    <div class="kbd">&gt;</div>
    <div>
      <button
        onclick={(ev) => {
          ev.preventDefault();
          switchToCommandPalette();
        }}
        class="link">command palette</button
      >
    </div>
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="dlg absolute flex flex-col z-20 center-x-with-translate top-8 max-h-[90vh] w-[42em] max-w-[90vw] p-2"
>
  {#if header}
    <div class="font-bold mb-2 text-lg ml-1">{header}</div>
  {/if}
  {@render noteFilterInput(nf)}
  <ListBox
    bind:this={listboxRef}
    items={nf.filtered}
    selectionChanged={nf.selectionChanged}
    onclick={(item, metaPressed) => nf.openNote(item, metaPressed)}
  >
    {#snippet renderItem(noteInfo)}
      <div class="flex w-full relative group">
        {@render noteItemRow(noteInfo, nf, noteNameCls(noteInfo.name))}

        <div
          class="absolute top-0 right-2 opacity-0 invisible group-hover:visible group-hover:opacity-100 flex items-center self-center bg-gray-100"
        >
          {#if isNoteArchivable(noteInfo.name)}
            {#if isNoteArchived(noteInfo.name)}
              <button
                title="unarchive note"
                class="clickable-icon"
                onclick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  unArchiveNote(noteInfo.name);
                }}>{@render IconTablerArchive()}</button
              >
            {:else}
              <button
                title="archive note"
                class="clickable-icon"
                onclick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  archiveNote(noteInfo.name);
                }}>{@render IconTablerArchive()}</button
              >
            {/if}
          {/if}
        </div>
      </div>
    {/snippet}
  </ListBox>

  <div class="flex justify-center mt-2">
    {#if nf.actions.canCreate}
      <button onclick={() => createNote(nf.sanitizedFilter)} class="truncate button-outline cursor-pointer max-w-[80%]"
        >Create Note <b>{nf.sanitizedFilter}</b></button
      >
    {/if}
  </div>

  {#if nf.actions.canOpenSelected || nf.actions.canDeleteSelected || nf.filter.length > 0}
    <!-- <hr class="mt-2 border-gray-300 dark:border-gray-600" /> -->
  {/if}

  {#if !forMoveBlock}
    {@render showArchived()}
    {#if appState.noteSelectorInfoCollapsed}
      {@render shortHelp()}
    {:else}
      {@render longHelp()}
    {/if}
  {/if}
</form>

<style lang="postcss">
  @reference "tailwindcss";

  .clickable-icon {
    @apply cursor-pointer px-1 py-1;

    &:hover {
      @apply bg-gray-200 dark:bg-gray-500;
    }
  }
</style>
