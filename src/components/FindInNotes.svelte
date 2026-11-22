<script lang="ts">
  import { onMount, tick } from "svelte";
  import { focus, trapfocus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { loadNote } from "../notes";
  import { findMatchesInNote } from "../find-in-notes";
  import { hilightText, len, makeHilightRegExp, splitStringPreservingQuotes } from "../util";
  import { IconFluentWholeWord, IconTablerLetterCase } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  interface Props {
    openNote: (name: string, pos: number) => void;
    // content to search; the open note's content can have unsaved edits so
    // positions in saved content would be off (U23)
    getNoteContent?: (name: string) => Promise<string | undefined>;
  }
  let { openNote, getNoteContent = loadNote }: Props = $props();

  let searchTerm = $state("");
  let replaceTerm = $state("");

  let currSearchTerm = "";
  let selectedItem: { note: string; pos?: number } | undefined;

  let searchInputRef: HTMLInputElement;

  let replaceInputRef: HTMLInputElement | undefined = $state(undefined);

  let results: { key: number; note: string; line?: string; pos?: number }[] = $state([]);
  let noteBeingSearched = $state("");

  // svelte-ignore non_reactive_update
  let hiliRegExp: RegExp | undefined;
  // svelte-ignore non_reactive_update
  let listboxRef: ListBox;

  const kMaxSearchResults = 64;
  let uniqueId = 0;
  let lastChangeNo = 0;
  let changeNo = 1;

  let noResultsMsg = $state("");

  // identifies the latest search. Only the latest search updates results (F-I1)
  // and closing the dialog stops it (F-I2)
  let searchId = 0;

  async function searchAllNotes(searchTerm: string) {
    let id = ++searchId;
    currSearchTerm = searchTerm;
    hiliRegExp = makeHilightRegExp(searchTerm);
    results = [];
    selectedItem = undefined;
    lastChangeNo = changeNo;
    noResultsMsg = "";
    let notesToSearch = $state.snapshot(appState.regularNotes);
    if (appState.searchIncludeArchived) {
      notesToSearch.push(...$state.snapshot(appState.archivedNotes));
    }

    let matchCase = appState.searchNotesMatchCase;
    let wholeWord = appState.searchNotesMatchWholeWord;

    if (!matchCase) {
      searchTerm = searchTerm.toLowerCase();
    }
    let parts = splitStringPreservingQuotes(searchTerm);
    while (len(notesToSearch) > 0) {
      noteBeingSearched = notesToSearch[0]!;
      notesToSearch.splice(0, 1);
      let content: string | undefined;
      try {
        content = await getNoteContent(noteBeingSearched);
      } catch (e) {
        // e.g. encrypted note and the user cancelled the password dialog
        console.log(`find in notes: failed to load '${noteBeingSearched}'`, e);
      }
      if (id !== searchId) {
        // a newer search started or the dialog was closed
        return;
      }
      if (!content) continue;
      let maxResults = kMaxSearchResults - len(results);
      for (let m of findMatchesInNote(content, parts, matchCase, wholeWord, maxResults)) {
        results.push({
          key: uniqueId,
          note: noteBeingSearched,
          line: m.line,
          pos: m.pos,
        });
        uniqueId++;
      }
      if (len(results) >= kMaxSearchResults) {
        notesToSearch = [];
      }
    }
    noteBeingSearched = "";
    if (len(results) == 0) {
      noResultsMsg = `No results for '${currSearchTerm}'`;
    }
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (ev.key == "Enter") {
      ev.preventDefault();
      let sameSearchTerm = searchTerm == currSearchTerm;
      if (sameSearchTerm && lastChangeNo == changeNo && len(results) > 0 && selectedItem) {
        openItem(selectedItem);
      } else {
        searchAllNotes(searchTerm);
      }
      return;
    }
    listboxRef?.onkeydown(ev, searchTerm === "");
  }

  function focusInput() {
    tick().then(() => {
      searchInputRef.select();
    });
  }
  onMount(() => {
    focusInput();
    // note: mouse tracking is disabled by App while a dialog is open

    return () => {
      // stop the search in progress
      searchId++;
    };
  });

  function matchCase() {
    appState.searchNotesMatchCase = !appState.searchNotesMatchCase;
    changeNo++; // make Enter redo the search
    focusInput();
  }
  function matchWholeWOrd() {
    appState.searchNotesMatchWholeWord = !appState.searchNotesMatchWholeWord;
    changeNo++; // make Enter redo the search
    focusInput();
  }
  function btnPressedCls(isPressed: boolean) {
    return isPressed ? "bg-gray-100 border-1 border-gray-300" : "bg-white border-1 border-white";
  }
  let matchCaseCls = $derived(btnPressedCls(appState.searchNotesMatchCase));
  let matchWholeWordCls = $derived(btnPressedCls(appState.searchNotesMatchWholeWord));

  function openItem(item: { note: string; pos?: number }) {
    // console.log("openItem:", $state.snapshot(item));
    openNote(item.note, item?.pos || 0);
  }

  function selectionChanged(item: { note: string; pos?: number } | undefined, idx: number) {
    // console.log("selectionChanged:", $state.snapshot(item), idx);
    selectedItem = item;
  }
</script>

{#snippet InsideInput()}
  <div class="absolute right-1 top-1.5 flex">
    <button class="btn-icon {matchCaseCls}" onclick={matchCase} title="Match Case"
      >{@render IconTablerLetterCase()}</button
    >
    <button class="btn-icon {matchWholeWordCls}" onclick={matchWholeWOrd} title="Match Whole Word"
      >{@render IconFluentWholeWord()}</button
    >
  </div>
{/snippet}

{#snippet InputTop()}
  <input
    bind:this={searchInputRef}
    type="text"
    class="w-full"
    spellcheck="false"
    placeholder="Find in notes, Enter to start search"
    bind:value={searchTerm}
    use:focus
    onkeydown={onKeyDown}
  />
{/snippet}

{#snippet InputBottom()}
  <input
    bind:this={replaceInputRef}
    type="text"
    spellcheck="false"
    placeholder="Replace"
    bind:value={replaceTerm}
    class="w-full"
  />
{/snippet}

<div
  class="absolute top-8 left-1/2 -translate-x-1/2 z-20 bg-white dark:text-sm w-4/5 shadow-lg border border-gray-300 max-h-[90vh] flex flex-col p-2 dlg-colors"
  use:trapfocus
>
  <div class="flex flex-row mb-2">
    <div class="flex flex-col grow">
      <div class="flex">
        <!-- top row -->
        <div class="relative grow">
          {@render InputTop()}
          {@render InsideInput()}
        </div>
      </div>
    </div>
  </div>

  {#if noResultsMsg}
    <div class=" px-2 py-4 mt-2 flex justify-center">
      <div>{noResultsMsg}</div>
    </div>
  {/if}
  {#if len(results) > 0}
    <ListBox bind:this={listboxRef} items={results} {selectionChanged} onclick={(item) => openItem(item)}>
      {#snippet renderItem(searchResult)}
        {@const hili = hilightText(searchResult.line, hiliRegExp!)}
        <div class="ml-2 truncate">
          {@html hili}
        </div>
        <div class="grow"></div>
        <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap max-w-[24ch] truncate" title={searchResult.note}>
          {searchResult.note}
        </div>
      {/snippet}
    </ListBox>
  {/if}

  {#if noteBeingSearched}
    <div class="bg-amber-50 px-2 mt-2 flex justify-center">
      <div>{noteBeingSearched}</div>
    </div>
  {/if}
  <div
    class="flex items-baseline gap-4 text-gray-700 text-xs max-w-full dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 pt-1 pb-1.5 mt-2"
  >
    {#if len(appState.archivedNotes) > 0}
      {#if appState.searchIncludeArchived}
        <button
          onclick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            appState.searchIncludeArchived = false;
            changeNo++; // make Enter redo the search
            searchInputRef.focus();
          }}
          class="link">exclude {len(appState.archivedNotes)} archived</button
        >
      {:else}
        <button
          onclick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            appState.searchIncludeArchived = true;
            changeNo++; // make Enter redo the search
            searchInputRef.focus();
          }}
          class="link">include {len(appState.archivedNotes)} archived</button
        >
      {/if}
    {/if}

    <div class="grow"></div>
    <div>Enter: start search</div>
    <div>Esc: dismiss</div>
    <a class="link" href="/help#search-in-notes" target="_blank">learn more</a>
  </div>
</div>

<style lang="postcss">
  @reference "tailwindcss";

  input {
    @apply bg-white px-2 py-1 border border-gray-200 dark:border-gray-600 outline-1 outline-gray-200 dark:outline-gray-600;
  }

  .btn-icon {
    @apply px-1.5 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-500 dark:bg-gray-900 border-0;
  }
</style>
