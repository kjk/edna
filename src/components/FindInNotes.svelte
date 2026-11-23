<script lang="ts">
  import { onMount, tick } from "svelte";
  import { focus, trapfocus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { loadNote } from "../notes";
  import { findMatchesInNote } from "../find-in-notes";
  import {
    btnPressedCls,
    handleEnter,
    handleListKeydown,
    hilightText,
    len,
    makeHilightRegExp,
    splitStringPreservingQuotes,
    toggleFlag,
    valueOrUndefined,
  } from "../util";
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

  let currSearchTerm = "";
  let selectedItem: { note: string; pos?: number } | undefined;

  let searchInputRef: HTMLInputElement;


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
      // can fail e.g. for an encrypted note if the user cancelled the password dialog
      let content = await valueOrUndefined(
        getNoteContent(noteBeingSearched),
        `find in notes: failed to load '${noteBeingSearched}'`,
      );
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
    handleListKeydown(ev, listboxRef, searchTerm === "", (ev) =>
      handleEnter(ev, () => {
        let sameSearchTerm = searchTerm == currSearchTerm;
        if (sameSearchTerm && lastChangeNo == changeNo && len(results) > 0 && selectedItem) {
          openItem(selectedItem);
        } else {
          searchAllNotes(searchTerm);
        }
      }),
    );
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

  function toggleOption(option: "searchNotesMatchCase" | "searchNotesMatchWholeWord" | "searchIncludeArchived") {
    toggleFlag(appState, option);
    changeNo++; // make Enter redo the search
    focusInput();
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
    <button class="btn-icon {matchCaseCls}" onclick={() => toggleOption("searchNotesMatchCase")} title="Match Case"
      >{@render IconTablerLetterCase()}</button
    >
    <button class="btn-icon {matchWholeWordCls}" onclick={() => toggleOption("searchNotesMatchWholeWord")} title="Match Whole Word"
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
      <button
        onclick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleOption("searchIncludeArchived");
        }}
        class="link"
        >{appState.searchIncludeArchived ? "exclude" : "include"} {len(appState.archivedNotes)} archived</button
      >
    {/if}

    <div class="grow"></div>
    <div>Enter: start search</div>
    <div>Esc: dismiss</div>
    <a class="link" href="/help#search-in-notes" target="_blank">learn more</a>
  </div>
</div>

<style lang="postcss">
  @reference "../main.css";

  input {
    @apply find-input;
  }

  .btn-icon {
    @apply find-btn;
  }
</style>
