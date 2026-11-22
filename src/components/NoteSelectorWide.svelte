<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { kScratchNoteName } from "../constants";
  import { reassignNoteShortcut, toggleNoteStarred } from "../metadata";
  import { findNoteIgnoreCase, isSystemNoteName, sanitizeNoteName } from "../notes";
  import {
    findMatchingItems,
    getAltChar,
    hilightText,
    isAltNumEvent,
    isKeyCtrlDelete,
    len,
    makeHilightRegExp,
  } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildRegularAndArchivedNoteInfos, noteShortcutStr } from "./NoteSelector.svelte";
  import type { NoteInfo } from "./NoteSelector.svelte";

  interface Props {
    openNote: (name: string, newTab: boolean) => void;
    createNote: (name: string) => void;
    deleteNote: (name: string, showNotif: boolean) => Promise<void>;
    switchToCommandPalette: () => void;
    switchToRegularNoteSelector: () => void;
  }
  let { openNote, createNote, deleteNote, switchToCommandPalette, switchToRegularNoteSelector }: Props = $props();

  let noteInfos = $derived(
    buildRegularAndArchivedNoteInfos(appState.regularNotes, appState.showingArchived ? appState.archivedNotes : []),
  );

  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = getAltChar();

  let sanitizedFilter = $derived.by(() => {
    return sanitizeNoteName(filter);
  });

  // note: must be in $effect because it modifies state, which is not allowed in $derived
  $effect(() => {
    if (sanitizedFilter.startsWith(">")) {
      switchToCommandPalette();
    }
  });

  let itemsFiltered = $derived.by(() => {
    // we split the search term by space, the name of the note
    // must match all parts
    if (sanitizedFilter.startsWith(">")) {
      return [];
    }
    return findMatchingItems(noteInfos, sanitizedFilter, "nameLC");
  });

  let selectedItem: NoteInfo | undefined = $state();
  let selectedName = $state("");
  let canOpenSelected = $state(false);
  let canCreate = $state(false);
  let canCreateWithEnter = $state(false);
  let canDeleteSelected = $state(false);
  let showDelete = $state(false);

  let notesCountMsg = $derived.by(() => {
    let n = len(itemsFiltered);
    if (n === 0) {
      return ""; // don't obscure user entering new, long note name
    }
    let nItems = len(noteInfos);
    if (n === nItems) {
      return `${nItems} notes`;
    }
    return `${n} of ${nItems} notes`;
  });

  function selectionChanged(item: NoteInfo, idx: number) {
    // console.log("selection: ", idx, item.name);
    selectedItem = item;
    selectedName = item ? selectedItem.name : "";
    canOpenSelected = !!selectedItem;

    // TODO: use lowerCase name?
    let name = sanitizeNoteName(filter);
    // check all notes, not just visible ones (archived notes might be hidden)
    // to not overwrite an existing note (N-I1)
    canCreate = len(name) > 0 && !findNoteIgnoreCase(name);

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

  async function onKeydown(ev: KeyboardEvent) {
    // console.log("onKeyDown:", event);
    let altN = isAltNumEvent(ev);
    if (altN !== null) {
      ev.preventDefault();
      let note = selectedItem;
      if (note) {
        await reassignNoteShortcut(note.name, altN);
        return;
      }
    }
    let key = ev.key;

    if (key === "s" && ev.altKey && selectedItem) {
      ev.preventDefault();
      toggleStarred(selectedItem);
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
        emitOpenNote(selectedItem, false);
      }
    } else if (isKeyCtrlDelete(ev)) {
      ev.preventDefault();
      if (!canDeleteSelected) {
        return;
      }
      if (selectedItem) {
        deleteNote(selectedItem.name, false);
      }
      return;
    }

    // console.log("listbox:", listbox);
    let allowLeftRight = filter === "" || isCursorAtEnd(inputRef);
    listboxComp.onkeydown(ev, allowLeftRight);
  }

  function isCursorAtEnd(input: HTMLInputElement) {
    const cursorPosition = input.selectionStart;
    const inputLength = input.value.length;
    return cursorPosition === inputLength;
  }

  function emitOpenNote(noteInfo: NoteInfo, newTab: boolean) {
    // console.log("emitOpenNote", noteInfo.name, "newTab:", newTab);
    openNote(noteInfo.name, newTab);
  }

  function emitCreateNote(name: string) {
    // log("create note", name);
    createNote(name);
  }

  async function toggleStarred(noteInfo: NoteInfo) {
    // note: UI is updated via updateAfterNoteStateChange() after metadata is saved
    await toggleNoteStarred(noteInfo.name);
    inputRef.focus();
  }

  let inputRef: HTMLInputElement;
  let listboxComp: ListBox;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="dlg z-20 absolute center-x-with-translate top-8 flex flex-col max-h-[90vh] w-[95vw] p-2"
>
  <div>
    <input
      bind:this={inputRef}
      bind:value={filter}
      use:focus
      type="text"
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-4 top-3 italic text-gray-400">
      {notesCountMsg}
    </div>
  </div>

  <ListBox
    bind:this={listboxComp}
    layout="inline"
    items={itemsFiltered}
    {selectionChanged}
    onclick={(item: any, metaPressed: boolean) => emitOpenNote(item, metaPressed)}
  >
    {#snippet renderItem(item)}
      {@const hili = hilightText(item.name, hiliRegExp)}
      {#if item.isStarred}
        {@render IconTablerStar("var(--color-yellow-300)", "inline-block mt-[-3px]")}
      {/if}
      {@html hili}
      <span class="ml-0.5 mr-0.5 text-xs text-gray-400 whitespace-nowrap">{noteShortcutStr(item)}</span>
    {/snippet}
  </ListBox>

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
        class="link"
        title="switch to regualar note dlg">regular</button
      >
    </div>
  </div>
</form>
