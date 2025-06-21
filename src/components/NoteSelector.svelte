<script module>
  /** @typedef {{
    key: number,
    name: string,
    nameLC: string,
    altShortcut?: number, // if present, 1 to 9 for Alt-1 to Alt-9
    isStarred: boolean,
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
    // first those with Alt shortcut
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
    /** @type {NoteInfo} */
    let item = {
      key: lastKey,
      name: name,
      nameLC: name.toLowerCase(),
      isStarred: false,
      ref: null,
    };
    lastKey++;
    let m = getNoteMeta(name, false);
    if (!m) {
      return item;
    }
    let n = parseInt(m.altShortcut);
    if (n >= 1 && n <= 9) {
      item.altShortcut = n;
    }
    item.isStarred = !!m.isStarred;
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
  import {
    getNoteMeta,
    reassignNoteShortcut,
    toggleNoteStarred,
  } from "../metadata";
  import { isSystemNoteName, sanitizeNoteName } from "../notes";
  import { appState } from "../state.svelte";
  import {
    findMatchingItems,
    getAltChar,
    hilightText,
    isAltNumEvent,
    len,
    makeHilightRegExp,
    noOp,
  } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  /** @type {{
    header?: string,
    openNote: (name: string) => void,
    createNote: (name: string) => void,
    deleteNote?: (name: string) => Promise<void>,
    switchToCommandPalette?: () => void,
    switchToWideNoteSelector?: () => void,
    forMoveBlock?: boolean,
}}*/
  let {
    header = undefined,
    openNote,
    createNote,
    deleteNote = async (name) => {},
    switchToCommandPalette = noOp,
    switchToWideNoteSelector = noOp,
    forMoveBlock = false,
  } = $props();

  let noteInfos = $state(buildNoteInfos(appState.noteNames));
  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = getAltChar();

  function reloadNotes() {
    console.log("reloadNotes");
    // actions like re-assigning quick access shortcut do
    // not modify appState.noteNames so we have to force
    // rebuilding of items
    noteInfos = buildNoteInfos(appState.noteNames);
  }

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
    // $state(`${noteCount} notes`);
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

  function selectionChanged(item, idx) {
    // console.log("selectionChanged:", $state.snapshot(item), idx);
    selectedNote = item;
    selectedName = item ? selectedNote.name : "";
    canOpenSelected = !!selectedNote;

    // TODO: use lowerCase name?
    let name = sanitizeNoteName(filter);
    canCreate = len(name) > 0;
    for (let i of filteredNoteInfos) {
      if (i.name === name) {
        canCreate = false;
        break;
      }
    }

    canCreateWithEnter = !canOpenSelected;
    // if there are no matches for the filter, we can create with just Enter
    // otherwise we need Ctrl + Enter
    if (name.length === 0) {
      canCreateWithEnter = false;
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
   * @param {NoteInfo} note
   * @returns {string}
   */
  function sysNoteCls(note) {
    return isSystemNoteName(note.name) ? "italic" : "";
  }

  /**
   * @param {KeyboardEvent} ev
   * @returns {boolean}
   */
  function isCtrlDelete(ev) {
    return (ev.key === "Delete" || ev.key === "Backspace") && ev.ctrlKey;
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
        reassignNoteShortcut(note.name, altN).then(reloadNotes);
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
        emitOpenNote(selectedNote);
      }
      return;
    }

    if (isCtrlDelete(ev)) {
      ev.preventDefault();
      if (canDeleteSelected && selectedNote) {
        // console.log("deleteNote", name);
        deleteNote(selectedNote.name).then(reloadNotes);
      }
      return;
    }

    listbox.onkeydown(ev, filter === "");
  }

  /**
   * @param {NoteInfo} noteInfo
   */
  function emitOpenNote(noteInfo) {
    // console.log("emitOpenNote", item);
    openNote(noteInfo.name);
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
    input.focus();
  }

  function toggleInfoPanelCollapsed() {
    appState.noteSelectorInfoCollapsed = !appState.noteSelectorInfoCollapsed;
  }

  let input;
  let listbox;
</script>

{#snippet shortHelp()}
  <div
    class="flex justify-between text-gray-700 text-xs max-w-full dark:text-white dark:text-opacity-50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
  >
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
        can't delete <span class="font-bold">{selectedName}</span>
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
  class="selector absolute flex flex-col z-20 center-x-with-translate top-[2rem] max-h-[90vh] w-[32em] p-2"
>
  {#if header}
    <div class="font-bold mb-2 text-lg ml-1">{header}</div>
  {/if}
  <div class="relative">
    <input
      type="text"
      use:focus
      bind:this={input}
      bind:value={filter}
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-[0.5rem] top-[0.25rem] italic text-gray-400">
      {notesCountMsg}
    </div>
  </div>
  <ListBox
    bind:this={listbox}
    items={filteredNoteInfos}
    {selectionChanged}
    onclick={(item) => emitOpenNote(item)}
  >
    {#snippet renderItem(noteInfo)}
      {@const hili = hilightText(noteInfo.name, hiliRegExp)}
      <button
        tabindex="-1"
        class="ml-[-6px] cursor-pointer hover:text-yellow-600"
        onclick={(ev) => {
          toggleStarred(noteInfo);
          ev.preventDefault();
          ev.stopPropagation();
        }}
      >
        {@render IconTablerStar(
          noteInfo.isStarred ? "var(--color-yellow-300)" : "none",
        )}
      </button>
      <div class="ml-2 truncate {sysNoteCls(noteInfo) ? 'italic' : ''}">
        {@html hili}
      </div>
      <div class="grow"></div>
      <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">
        {noteShortcut(noteInfo)}
      </div>
    {/snippet}
  </ListBox>

  {#if canOpenSelected || canDeleteSelected || filter.length > 0}
    <!-- <hr class="mt-2 border-gray-300 dark:border-gray-600" /> -->
  {/if}

  {#if !forMoveBlock}
    {#if appState.noteSelectorInfoCollapsed}
      {@render shortHelp()}
    {:else}
      {@render longHelp()}
    {/if}
  {/if}
</form>
