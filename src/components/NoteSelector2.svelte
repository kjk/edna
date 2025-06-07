<script>
  import {
    getLatestNoteNames,
    isSystemNoteName,
    sanitizeNoteName,
  } from "../notes";
  import { reassignNoteShortcut, toggleNoteStarred } from "../metadata";
  import {
    findMatchingItems,
    getAltChar,
    hilightText,
    isAltNumEvent,
    len,
    makeHilightRegExp,
  } from "../util";
  import { focus, smartfocus, trapfocus } from "../actions";
  import ListBox from "./ListBox.svelte";
  import IconStar from "./IconStar.svelte";
  import { appState } from "../state.svelte";
  import { buildItems } from "./NoteSelector.svelte";

  /** @typedef {import("./NoteSelector.svelte").Item} Item */

  /** @type {{
    onclose: () => void,
    openNote: (name: string) => void,
    createNote: (name: string) => void,
    deleteNote: (name: string) => Promise<void>,
    switchToCommandPalette: () => void,
  }}*/
  let { onclose, openNote, createNote, deleteNote, switchToCommandPalette } =
    $props();

  let noteNames = getLatestNoteNames();
  let items = $state(buildItems(noteNames));
  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = $state(getAltChar());

  function reloadNotes() {
    console.log("reloadNotes");
    let noteNames = getLatestNoteNames();
    items = buildItems(noteNames);
  }

  let sanitizedFilter = $derived.by(() => {
    return sanitizeNoteName(filter);
  });

  $effect(() => {
    if (sanitizedFilter.startsWith(">")) {
      switchToCommandPalette();
    }
  });

  let itemsFiltered = $derived.by(() => {
    // we split the search term by space, the name of the note
    // must match all parts
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
      if (item.name !== "scratch" && !isSystemNoteName(item.name)) {
        // can't delete scratch note or system notes
        canDeleteSelected = true;
      }
    }

    showDelete = canOpenSelected;
  }

  /**
   * @param {Item} note
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
   * @param {Item} note
   * @returns {string}
   */
  function noteShortcut(note) {
    return note.altShortcut ? altChar + " + " + note.altShortcut : "";
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
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

    if (key === "Escape") {
      if (filter !== "") {
        filter = "";
      } else {
        onclose();
      }
      ev.preventDefault();
      ev.stopPropagation();
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
        // console.log("deleteNote", name);
        deleteNote(selectedItem.name).then(reloadNotes);
      }
      return;
    }

    listbox.onkeydown(ev, filter === "");
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

  function toggleInfoPanelCollapsed() {
    appState.noteSelectorInfoCollapsed = !appState.noteSelectorInfoCollapsed;
  }

  let input;
  let listbox;
</script>

<div class="fixed inset-0 overflow-hidden">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="z-10" {onkeydown} tabindex="-1" use:smartfocus use:trapfocus>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <form
      class="absolute flex flex-col w-full h-full p-2 text-sm bg-white dark:bg-gray-900 dark:text-gray-300"
    >
      <div class="">
        <input
          type="text"
          use:focus
          bind:this={input}
          bind:value={filter}
          class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
        />
        <div class="absolute right-[1rem] top-[0.75rem] italic text-gray-400">
          {itemsCountMsg}
        </div>
      </div>

      <ListBox
        bind:this={listbox}
        items={itemsFiltered}
        {selectionChanged}
        onclick={(item) => emitOpenNote(item)}
      >
        {#snippet renderItem(item)}
          {@const hili = hilightText(item.name, hiliRegExp)}
          <button
            class="ml-[-6px]"
            onclick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              toggleStarred(item);
            }}
            ><IconStar
              fill={item.isStarred ? "var(--color-yellow-300)" : "none"}
            ></IconStar></button
          >
          <div class="ml-2 truncate {sysNoteCls(item) ? 'italic' : ''}">
            {@html hili}
          </div>
          <div class="grow"></div>
          <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">
            {noteShortcut(item)}
          </div>
        {/snippet}
      </ListBox>

      <div class="grow"></div>

      {#if canOpenSelected || canDeleteSelected || filter.length > 0}
        <!-- <hr class="mt-2 border-gray-300 dark:border-gray-600" /> -->
      {/if}

      {#if appState.noteSelectorInfoCollapsed}
        <div
          class="flex justify-between text-gray-700 text-xs max-w-full dark:text-white dark:text-opacity-50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
        >
          <div></div>
          <button
            onclick={(ev) => {
              ev.preventDefault();
              toggleInfoPanelCollapsed();
            }}
            title="show info panel"
            class="underline underline-offset-2 cursor-pointer"
          >
            show</button
          >
        </div>
      {:else}
        <div class="selector-info">
          <div class="flex flex-col items-right absolute bottom-3 right-4">
            <button
              onclick={(ev) => {
                ev.preventDefault();
                toggleInfoPanelCollapsed();
              }}
              title="hide info panel"
              class="underline underline-offset-2 cursor-pointer"
            >
              hide</button
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
            <div>
              assign quick access shortcut to <span class="font-bold"
                >{selectedName}</span
              >
            </div>
          {/if}

          {#if canOpenSelected}
            <div class="kbd">{altChar} + S</div>
            <div>toggle favorite</div>
          {/if}

          <div class="kbd">Esc</div>
          <div>back to note</div>
        </div>
      {/if}
    </form>
  </div>
</div>
