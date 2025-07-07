<script module>
  /** @typedef {{
    key: number,
    name: string,
    nameLC: string,
    isStarred: boolean,
    isArchived: boolean,
    altShortcut?: number, // if present, 1 to 9 for Alt-1 to Alt-9
    ref: HTMLElement,
  }} NoteInfo
*/

  /**
   * -1 if a < b
   * 0 if a = b
   * 1 if a > b
   * @param {NoteInfo} a
   * @param {NoteInfo} b
   */
  export function sortNotes(a, b) {
    // first archived
    if (a.isArchived && !b.isArchived) {
      return -1;
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

  /**
   * @param {string} name
   * @returns {NoteInfo}
   */
  export function buildNoteInfo(name) {
    let isArchived = false;
    let isStarred = false;
    let m = getNoteMeta(name, false);
    if (m) {
      isStarred = m.isStarred;
      isArchived = m.isArchived;
    }
    /** @type {NoteInfo} */
    let item = {
      key: lastKey,
      name: name,
      nameLC: name.toLowerCase(),
      isStarred: isStarred,
      isArchived: isArchived,
      ref: null,
    };
    lastKey++;
    let n = parseInt(m?.altShortcut);
    if (n >= 1 && n <= 9) {
      item.altShortcut = n;
    }
    return item;
  }

  /**
   * @param {string[]} noteNames
   * @returns {NoteInfo[]}
   */
  export function buildNoteInfos(noteNames) {
    // console.log("buildItems, notes", noteInfos)
    /** @type {NoteInfo[]} */
    let res = Array(len(noteNames));
    for (let i = 0; i < len(noteNames); i++) {
      let name = noteNames[i];
      let item = buildNoteInfo(name);
      res[i] = item;
    }
    res.sort(sortNotes);
    return res;
  }
</script>

<script>
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
  import {
    isNoteArchivable,
    isSystemNoteName,
    sanitizeNoteName,
  } from "../notes";
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
  import {
    IconTablerArchive,
    IconTablerStar,
    IconTablerTrash,
  } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  /** @type {{
    header?: string,
    openNote: (name: string, newTab: boolean) => void,
    createNote: (name: string) => void,
    deleteNote: (name: string, showNotif: boolean) => Promise<void>,
    switchToCommandPalette?: () => void,
    switchToWideNoteSelector?: () => void,
    forMoveBlock?: boolean,
}}*/
  let {
    header = undefined,
    openNote,
    createNote,
    deleteNote,
    switchToCommandPalette = noOp,
    switchToWideNoteSelector = noOp,
    forMoveBlock = false,
  } = $props();

  function localBuildNoteInfos(regular, archived) {
    let notes = [...regular];
    notes.push(...archived);
    let res = buildNoteInfos(notes);
    return res;
  }
  let noteInfos = $derived(
    localBuildNoteInfos(
      appState.regularNotes,
      appState.showingArchived ? appState.archivedNotes : [],
    ),
  );

  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = getAltChar();

  // TODO: why is this no longer needed?
  // function updateNoteInfos() {
  //   // actions like re-assigning quick access shortcut do
  //   // not modify appState.noteNames so we have to force
  //   // rebuilding of items
  //   noteInfos = localBuildNoteInfos(
  //     appState.regularNotes,
  //     appState.showingArchived ? appState.archivedNotes : [],
  //   );
  // }

  let sanitizedFilter = $derived.by(() => {
    return sanitizeNoteName(filter);
  });

  $effect(() => {
    if (sanitizedFilter.startsWith(">")) {
      switchToCommandPalette();
    }
  });

  let filteredNoteInfos = $derived.by(() => {
    // we split the search term by space, the name of the note
    // must match all parts
    return findMatchingItems(noteInfos, sanitizedFilter, "nameLC");
  });

  /** @type {NoteInfo} */
  let selectedNote = $state(null);
  let selectedName = $state("");
  let canOpenSelected = $state(false);
  let canCreate = $state(false);
  let canCreateWithEnter = $state(false);
  let canDeleteSelected = $state(false);
  let showDelete = $state(false);

  let notesCountMsg = $derived.by(() => {
    let n = len(filteredNoteInfos);
    if (n === 0) {
      return ""; // don't obscure user entering new, long note name
    }
    let nItems = len(noteInfos);
    if (n === nItems) {
      return `${nItems} notes`;
    }
    return `${n} of ${nItems} notes`;
  });

  function recalcAvailableActions(item, name) {
    canOpenSelected = !!selectedNote;
    canCreateWithEnter = !(len(name) == 0) && !canOpenSelected;
    canCreate = len(name) > 0;
    for (let i of filteredNoteInfos) {
      if (i.name === name) {
        canCreate = false;
        canCreateWithEnter = false;
        break;
      }
    }

    canDeleteSelected = false;
    if (item && canOpenSelected) {
      if (item.name !== "scratch" && !isSystemNoteName(item.name)) {
        // can't delete scratch note or system notes
        canDeleteSelected = true;
      }
    }
    showDelete = canOpenSelected;
  }

  /**
   * @param {NoteInfo} item
   * @param {number} idx
   */
  function selectionChanged(item, idx) {
    console.warn("selectionChanged:", $state.snapshot(item.name), idx);
    selectedNote = item;
    selectedName = item ? selectedNote.name : "";
    recalcAvailableActions(item, sanitizedFilter);
  }

  /**
   * @param {NoteInfo} note
   * @returns {string}
   */
  function noteShortcut(note) {
    return note.altShortcut ? altChar + " + " + note.altShortcut : "";
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onKeydown(ev) {
    // console.log("onKeyDown:", event);
    let altN = isAltNumEvent(ev);
    if (altN !== null) {
      ev.preventDefault();
      let note = selectedNote;
      if (note) {
        reassignNoteShortcut(note.name, altN);
        //.then(updateNoteInfos);
        return;
      }
    }
    let key = ev.key;

    if (key === "s" && ev.altKey && selectedNote) {
      toggleStarred(selectedNote);
      ev.preventDefault();
      return;
    }

    if (key === "Enter") {
      ev.preventDefault();
      let name = sanitizedFilter;
      if (canCreateWithEnter) {
        emitCreateNote(name);
        return;
      }
      if (ev.ctrlKey && canCreate) {
        emitCreateNote(sanitizedFilter);
        return;
      }
      if (selectedNote) {
        emitOpenNote(selectedNote, false);
      }
      return;
    }

    if (isKeyCtrlDelete(ev)) {
      ev.preventDefault();
      if (canDeleteSelected && selectedNote) {
        // console.log("delete note", name);
        deleteNote(selectedNote.name, false);
        // .then(updateNoteInfos);
      }
      return;
    }

    listboxRef.onkeydown(ev, filter === "");
  }

  /**
   * @param {NoteInfo} noteInfo
   * @param {boolean} newTab
   */
  function emitOpenNote(noteInfo, newTab) {
    // console.log("emitOpenNote", noteInfo.name, "newTab:", newTab);
    openNote(noteInfo.name, newTab);
  }

  /**
   * @param {string} name
   */
  function emitCreateNote(name) {
    // log("create note", name);
    createNote(name);
  }

  /**
   * @param {NoteInfo} noteInfo
   */
  async function toggleStarred(noteInfo) {
    // there's a noticeable UI lag when we do the obvious:
    // item.isStarred = toggleNoteStarred(item.name);
    // because we wait until metadata file is saved
    // this version makes an optimistic change to reflect in UI
    // and, just to be extra sure, reflects the state after saving
    noteInfo.isStarred = !noteInfo.isStarred;
    toggleNoteStarred(noteInfo.name).then((isStarred) => {
      // not really necessary, should be in-sync
      noteInfo.isStarred = isStarred;
    });
    inputRef.focus();
  }

  function toggleInfoPanelCollapsed() {
    appState.noteSelectorInfoCollapsed = !appState.noteSelectorInfoCollapsed;
  }

  let inputRef;
  let listboxRef;

  function toggleShowArchived() {
    appState.showingArchived = !appState.showingArchived;
  }
  function showHideTxt(isShowing) {
    return isShowing ? "hide" : "show";
  }

  function noteCls(noteInfo) {
    let name = noteInfo.name;
    let m = getNoteMeta(name);
    let isArchived = m && m.isArchived;
    if (isSystemNoteName(name) || isArchived) {
      return "italic";
    }
    return "";
  }
</script>

{#snippet showArchived()}
  {#if len(appState.archivedNotes)}
    <div
      class="flex justify-around text-gray-700 text-sm max-w-full dark:text-white dark:text-opacity-50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
    >
      {#if len(appState.archivedNotes) > 0}
        <button
          onclick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            toggleShowArchived();
          }}
          class="underline underline-offset-2 cursor-pointer"
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
    class="flex justify-between text-gray-700 text-xs max-w-full dark:text-white dark:text-opacity-50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
  >
    {@render showArchived()}
    <button
      onclick={(ev) => {
        ev.preventDefault();
        switchToCommandPalette();
      }}
      class="underline underline-offset-2">command palette</button
    >
    <button
      onclick={(ev) => {
        ev.preventDefault();
        switchToWideNoteSelector();
      }}
      title="switch to wide note selector"
      class="underline underline-offset-2 cursor-pointer">wide</button
    >
    <button
      onclick={(ev) => {
        ev.preventDefault();
        toggleInfoPanelCollapsed();
      }}
      title="show help"
      class="underline underline-offset-2 cursor-pointer"
    >
      show help</button
    >
  </div>
{/snippet}

{#snippet longHelp()}
  <div class="selector-info">
    <div class="flex flex-col items-right absolute bottom-3 right-4">
      <button
        onclick={(ev) => {
          ev.preventDefault();
          switchToWideNoteSelector();
        }}
        title="switch to wide note selector"
        class="underline underline-offset-2 mb-1 cursor-pointer text-right"
        >wide</button
      >
      <button
        onclick={(ev) => {
          ev.preventDefault();
          toggleInfoPanelCollapsed();
        }}
        title="hide help"
        class="underline underline-offset-2 cursor-pointer"
      >
        hide help</button
      >
    </div>
    {#if canOpenSelected}
      <div class="kbd">Enter</div>
      <div class="truncate">
        open note <span class="font-bold">
          {selectedName}
        </span>
      </div>
    {/if}

    {#if canCreateWithEnter}
      <div class="kbd">Enter</div>
    {/if}
    {#if canCreate && !canCreateWithEnter}
      <div class="kbd">Ctrl + Enter</div>
    {/if}
    {#if canCreate}
      <div class="truncate">
        create note <span class="font-bold">
          {filter}
        </span>
      </div>
    {/if}

    {#if showDelete && canDeleteSelected}
      <div class="kbd">Ctrl + Delete</div>
      <div class="red truncate">
        delete note <span class="font-bold">
          {selectedName}
        </span>
      </div>
    {/if}

    {#if showDelete && !canDeleteSelected}
      <div class="kbd">Ctrl + Delete</div>
      <div class="red truncate">
        can't trash <span class="font-bold">{selectedName}</span>
      </div>
    {/if}

    {#if canOpenSelected}
      <div class="kbd">{altChar} + 1...9</div>
      <div>assign quick access shortcut</div>
    {/if}

    {#if canOpenSelected}
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
        class="underline underline-offset-2 cursor-pointer"
        >command palette</button
      >
    </div>
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="selector absolute flex flex-col z-20 center-x-with-translate top-[2rem] max-h-[90vh] w-[42em] max-w-[90vw] p-2"
>
  {#if header}
    <div class="font-bold mb-2 text-lg ml-1">{header}</div>
  {/if}
  <div class="relative">
    <input
      type="text"
      use:focus
      bind:this={inputRef}
      bind:value={filter}
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-[0.5rem] top-[0.25rem] italic text-gray-400">
      {notesCountMsg}
    </div>
  </div>
  <ListBox
    bind:this={listboxRef}
    items={filteredNoteInfos}
    {selectionChanged}
    onclick={(item, ev) => emitOpenNote(item, ev?.ctrlKey)}
  >
    {#snippet renderItem(noteInfo)}
      {@const hili = hilightText(noteInfo.name, hiliRegExp)}
      <div class="flex w-full relative group">
        <button
          tabindex="-1"
          class="ml-[-6px] cursor-pointer hover:text-yellow-600"
          onclick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            toggleStarred(noteInfo);
          }}
        >
          {@render IconTablerStar(
            noteInfo.isStarred ? "var(--color-yellow-300)" : "none",
          )}
        </button>
        <div class="ml-2 truncate {noteCls(noteInfo)}">
          {@html hili}
        </div>
        <div class="grow"></div>
        <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">
          {noteShortcut(noteInfo)}
        </div>

        <div
          class="absolute top-0 right-[8px] opacity-0 invisible group-hover:visible group-hover:opacity-100 flex items-center self-center bg-gray-100"
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
          <!-- {#if isNoteTrashable(noteInfo.name)}
            <button
              title={"permanently delete"}
              class="clickable-icon text-red-400"
              onclick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                deleteNote(noteInfo.name, false);
              }}>{@render IconTablerTrash()}</button
            >
          {/if} -->
        </div>
      </div>
    {/snippet}
  </ListBox>

  <div class="flex justify-center mt-2">
    {#if canCreate}
      <button class="truncate button-outline cursor-pointer max-w-[80%]"
        >Create Note <b>{filter}</b></button
      >
    {/if}
  </div>

  {#if canOpenSelected || canDeleteSelected || filter.length > 0}
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

<style>
  @reference "../main.css";

  .clickable-icon {
    @apply cursor-pointer px-1 py-1;

    &:hover {
      @apply bg-gray-200 dark:bg-gray-500;
    }
  }
</style>
