<script>
  import {
    isSystemNoteName,
    kScratchNoteName,
    sanitizeNoteName,
  } from "../notes";
  import {
    findMatchingItems,
    getAltChar,
    hilightText,
    isAltNumEvent,
    len,
    makeHilightRegExp,
  } from "../util";
  import { focus } from "../actions";
  import ListBox2 from "./ListBox2.svelte";
  import { reassignNoteShortcut, toggleNoteStarred } from "../metadata";
  import { buildNoteInfos } from "./NoteSelector.svelte";
  import { IconStar } from "./Icons.svelte";
  import { appState } from "../state.svelte";

  /** @typedef {import("./NoteSelector.svelte").NoteInfo} Item */

  /** @type {{
    openNote: (name: string) => void,
    createNote: (name: string) => void,
    deleteNote: (name: string) => Promise<void>,
    switchToCommandPalette: () => void,
    switchToRegularNoteSelector: () => void,
}}*/
  let {
    openNote,
    createNote,
    deleteNote,
    switchToCommandPalette,
    switchToRegularNoteSelector,
  } = $props();

  let noteNames = appState.noteNames;
  let items = $derived(buildNoteInfos(noteNames));
  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = getAltChar();

  let sanitizedFilter = $derived.by(() => {
    return sanitizeNoteName(filter);
  });

  let itemsFiltered = $derived.by(() => {
    // we split the search term by space, the name of the note
    // must match all parts
    if (sanitizedFilter.startsWith(">")) {
      switchToCommandPalette();
      return [];
    }
    return findMatchingItems(items, sanitizedFilter, "nameLC");
  });

  /** @type {Item} */
  let selectedItem = $state(null);
  let selectedName = $state("");
  let canOpenSelected = $state(false);
  let canCreate = $state(false);
  let canCreateWithEnter = $state(false);
  let canDeleteSelected = $state(false);
  let showDelete = $state(false);

  function reloadNotes() {
    let noteNames = appState.noteNames;
    items = buildNoteInfos(noteNames);
  }

  let itemsCountMsg = $derived.by(() => {
    // $state(`${noteCount} notes`);
    let n = len(itemsFiltered);
    if (n === 0) {
      return ""; // don't obscure user entering new, long note name
    }
    let nItems = len(items);
    if (n === nItems) {
      return `${nItems} notes`;
    }
    return `${n} of ${nItems} notes`;
  });

  function selectionChanged(item, idx) {
    // console.log("selectionChanged:", item, idx);
    selectedItem = item;
    selectedName = item ? selectedItem.name : "";
    canOpenSelected = !!selectedItem;

    // TODO: use lowerCase name?
    let name = sanitizeNoteName(filter);
    canCreate = len(name) > 0;
    for (let i of itemsFiltered) {
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
      if (item.name !== kScratchNoteName && !isSystemNoteName(item.name)) {
        // can't delete scratch note or system notes
        canDeleteSelected = true;
      }
    }

    showDelete = canOpenSelected;
  }

  /**
   * @param {KeyboardEvent} ev
   * @returns {boolean}
   */
  function isCtrlDelete(ev) {
    return (ev.key === "Delete" || ev.key === "Backspace") && ev.ctrlKey;
  }

  /**
   * @param {Item} note
   * @returns {string}
   */
  function noteShortcut(note) {
    if (note.altShortcut) {
      //console.log("noteShortcut:", note);
      return `${altChar} + ${note.altShortcut}`;
    }
    return "";
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onKeydown(ev) {
    // console.log("onKeyDown:", event);
    let altN = isAltNumEvent(ev);
    if (altN !== null) {
      ev.preventDefault();
      let note = selectedItem;
      if (note) {
        reassignNoteShortcut(note.name, altN).then(reloadNotes);
        return;
      }
    }
    let key = ev.key;

    if (key === "s" && ev.altKey && selectedItem) {
      toggleStarred(selectedItem);
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
      if (selectedItem) {
        emitOpenNote(selectedItem);
      }
    } else if (isCtrlDelete(ev)) {
      ev.preventDefault();
      if (!canDeleteSelected) {
        return;
      }
      if (selectedItem) {
        deleteNote(selectedItem.name).then(reloadNotes);
      }
      return;
    }

    // console.log("listbox:", listbox);
    let allowLeftRight = filter === "" || isCursorAtEnd(input);
    listbox.onkeydown(ev, allowLeftRight);
  }

  function isCursorAtEnd(input) {
    const cursorPosition = input.selectionStart;
    const inputLength = input.value.length;
    return cursorPosition === inputLength;
  }

  /**
   * @param {Item} item
   */
  function emitOpenNote(item) {
    // console.log("emitOpenNote", item);
    openNote(item.name);
  }

  function emitCreateNote(name) {
    // log("create note", name);
    createNote(name);
  }

  /**
   * @param {Item} item
   */
  async function toggleStarred(item) {
    // there's a noticeable UI lag when we do the obvious:
    // item.isStarred = toggleNoteStarred(item.name);
    // because we wait until metadata file is saved
    // this version makes an optimistic change to reflect in UI
    // and, just to be extra sure, reflects the state after saving
    item.isStarred = !item.isStarred;
    toggleNoteStarred(item.name).then((isStarred) => {
      // not really necessary, should be in-sync
      item.isStarred = isStarred;
    });
    input.focus();
  }

  let input;
  let listbox;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="selector z-20 absolute center-x-with-translate top-[2rem] flex flex-col max-h-[90vh] w-[95vw] p-2"
>
  <div>
    <input
      bind:this={input}
      bind:value={filter}
      use:focus
      type="text"
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-[1rem] top-[0.75rem] italic text-gray-400">
      {itemsCountMsg}
    </div>
  </div>
  <ListBox2
    bind:this={listbox}
    items={itemsFiltered}
    {selectionChanged}
    onclick={(item) => emitOpenNote(item)}
  >
    {#snippet renderItem(item)}
      {@const hili = hilightText(item.name, hiliRegExp)}
      {#if item.isStarred}
        {@render IconStar("var(--color-yellow-300)", "inline-block mt-[-3px]")}
      {/if}
      {@html hili}
      <span class="ml-0.5 text-xs text-gray-400 whitespace-nowrap"
        >{noteShortcut(item)}</span
      >
    {/snippet}
  </ListBox2>
  <div
    class="flex flex-row items-baseline justify-between mt-2 text-xs max-w-full bg-gray-100 dark:bg-gray-700 rounded-lg py-1 px-2"
  >
    {#if canOpenSelected}
      <div class="flex items-baseline">
        <div class="kbd">Enter</div>
        <div class="ml-2 mr-2">open</div>
      </div>
      <div class="text-gray-400">&bull;</div>
    {/if}

    {#if canCreate}
      <div class="flex items-baseline">
        {#if canCreateWithEnter}
          <div class="kbd">Enter</div>
        {/if}
        {#if canCreate && !canCreateWithEnter}
          <div class="kbd">Ctrl + Enter</div>
        {/if}
        {#if canCreate}
          <div class="ml-2">
            create <span class="font-bold truncate">
              {filter}
            </span>
          </div>
        {/if}
      </div>
      {#if !canCreateWithEnter}
        <div class="text-gray-400">&bull;</div>
      {/if}
    {/if}

    {#if showDelete}
      <div class="flex items-baseline">
        <div class="kbd">Ctrl + Delete</div>
        {#if canDeleteSelected}
          <div class="ml-2 red">delete</div>
        {:else}
          <div class="ml-2 red">
            can't delete <span class="font-bold truncate">{selectedName}</span>
          </div>
        {/if}
      </div>
    {/if}

    {#if canOpenSelected}
      <div class="text-gray-400">&bull;</div>
      <div class="flex items-baseline">
        <div class="kbd">{altChar} 1...9</div>
        <div class="ml-2">assign quick access shortcut</div>
      </div>

      <div class="text-gray-400">&bull;</div>
      <div class="flex items-baseline">
        <div class="kbd">{altChar} + S</div>
        <div class="ml-2">toggle favorite</div>
      </div>
    {/if}

    <div class="text-gray-400">&bull;</div>
    <div class="flex items-baseline">
      <div class="kbd">Esc</div>
      <div class="ml-2">dismiss</div>
    </div>

    <div class="text-gray-400">&bull;</div>
    <div class="flex items-baseline">
      <button
        onclick={(ev) => {
          ev.preventDefault();
          switchToRegularNoteSelector();
        }}
        class="underline underline-offset-2 cursor-pointer"
        title="switch to regualar note selector">regular</button
      >
    </div>
  </div>
</form>
