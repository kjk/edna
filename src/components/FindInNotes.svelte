<script>
  import { onMount, tick } from "svelte";
  import { focus, trapfocus } from "../actions";
  import { isMoving } from "../mouse-track.svelte";
  import { loadNote } from "../notes";
  import { appState } from "../state.svelte";
  import { hilightText, len, makeHilightRegExp } from "../util";
  import {
    IconFluentWholeWord,
    IconLucideReplace,
    IconLucideReplaceAll,
    IconTablerChevronDown,
    IconTablerChevronRight,
    IconTablerLetterCase,
    IconTablerX,
  } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  /** @type {{
    openNote: (name: string, pos: number) => void,
}}*/
  let { openNote } = $props();

  let searchTerm = $state("");
  let replaceTerm = $state("");
  let showReplace = $state(false);

  let currSearchTerm = "";
  let selectedItem;

  /** @type {HTMLInputElement} */
  let searchInputREf;

  /** @type {HTMLInputElement} */
  let replaceInputRef = $state(undefined);

  /** @type {{key: number, note: string}[]}*/
  let results = $state([]);
  let noteBeingSearched = $state("");

  // svelte-ignore non_reactive_update
  let hiliRegExp;
  // svelte-ignore non_reactive_update
  let listboxRef;

  function replace() {}
  function _replaceAll() {}

  function toggleShowReplace() {
    showReplace = !showReplace;
    if (showReplace) {
      tick().then(() => replaceInputRef.focus());
    } else {
      tick().then(() => searchInputREf.focus());
    }
  }

  const kMaxSearchResults = 64;
  let uniqueId = 0;
  async function startSearch(searchTerm) {
    currSearchTerm = searchTerm;
    hiliRegExp = makeHilightRegExp(searchTerm);
    results = [];
    selectedItem = null;
    let notesToSearch = $state.snapshot(appState.noteNames);

    while (len(notesToSearch) > 0) {
      noteBeingSearched = notesToSearch[0];
      notesToSearch.splice(0, 1);
      // TODO: need to remove histryPush()
      let s = await loadNote(noteBeingSearched);
      let startIdx = 0;
      let line;
      while (true) {
        let idx = s.indexOf(searchTerm, startIdx);
        if (idx < 0) {
          break;
        }
        startIdx = idx + 1;

        let lineStartIdx = s.lastIndexOf("\n", idx - 1) + 1;
        let lineEndIdx = s.indexOf("\n", idx + 1);
        if (lineEndIdx < 0) {
          line = s.substring(lineStartIdx);
        } else {
          line = s.substring(lineStartIdx, lineEndIdx);
        }
        let res = {
          key: uniqueId,
          note: noteBeingSearched,
          line: line,
          pos: idx,
        };
        uniqueId++;
        results.push(res);
        if (len(results) > kMaxSearchResults) {
          notesToSearch = [];
        }
      }
    }
    noteBeingSearched = "";
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onKeyDown(ev) {
    if (ev.key == "Enter") {
      ev.preventDefault();
      let sameSearchTerm = searchTerm == currSearchTerm;
      if (sameSearchTerm && len(results) > 0 && selectedItem) {
        openItem(selectedItem);
      } else {
        startSearch(searchTerm);
      }
      return;
    }
    listboxRef?.onkeydown(ev, searchTerm === "");
  }

  onMount(() => {
    tick().then(() => {
      searchInputREf.select();
    });
    isMoving.disableMoveTracking = true;

    return () => {
      isMoving.disableMoveTracking = false;
    };
  });

  function matchCase() {
    appState.searchMatchCase = !appState.searchMatchCase;
    console.log("matchCase", appState.searchMatchCase);
  }
  function matchWholeWOrd() {
    appState.searchMatchWholeWord = !appState.searchMatchWholeWord;
    console.log("matchWholeWOrd", appState.searchMatchWholeWord);
  }
  function btnPressedCls(isPressed) {
    return isPressed
      ? "bg-gray-100 border-1 border-gray-300"
      : "bg-white border-1 border-white";
  }
  let matchCaseCls = $derived(btnPressedCls(appState.searchMatchCase));
  let matchWholeWordCls = $derived(
    btnPressedCls(appState.searchMatchWholeWord),
  );

  function openItem(item) {
    // console.log("openItem:", $state.snapshot(item));
    openNote(item.note, item.pos);
  }

  function selectionChanged(item, idx) {
    // console.log("selectionChanged:", $state.snapshot(item), idx);
    selectedItem = item;
  }
</script>

// svelte-ignore non_reactive_update
{#snippet InsideInput()}
  <div class="absolute right-[0.25rem] top-[6px] flex">
    <button class={matchCaseCls} onclick={matchCase} title="Match Case"
      >{@render IconTablerLetterCase()}</button
    >
    <button
      class={matchWholeWordCls}
      onclick={matchWholeWOrd}
      title="Match Whole Word">{@render IconFluentWholeWord()}</button
    >
  </div>
{/snippet}

{#snippet InputTop()}
  <input
    bind:this={searchInputREf}
    type="text"
    class="w-full"
    spellcheck="false"
    placeholder="Find in notes"
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
  class="absolute top-[2rem] left-1/2 -translate-x-1/2 z-20 bg-white text-sm w-4/5 shadow-lg border border-gray-300 max-h-[90vh] flex flex-col p-2"
  use:trapfocus
>
  <div class="flex flex-row mb-2">
    {#if false}
      <div class="flex mr-1">
        {#if showReplace}
          <button onclick={toggleShowReplace} title="hide replace"
            >{@render IconTablerChevronDown()}</button
          >
        {:else}
          <button onclick={toggleShowReplace} title="show replace"
            >{@render IconTablerChevronRight()}</button
          >
        {/if}
      </div>
    {/if}

    <div class="flex flex-col grow">
      <div class="flex">
        <!-- top row -->
        <div class="relative grow">
          {@render InputTop()}
          {@render InsideInput()}
        </div>
      </div>
      {#if showReplace}
        <div class="flex">
          <!-- bottom row -->
          <div class="flex mt-2 grow">
            {@render InputBottom()}
            <button class="ml-2" title="replace" onclick={replace}
              >{@render IconLucideReplace()}</button
            >
            <button title="replace all" onclick={_replaceAll}
              >{@render IconLucideReplaceAll()}</button
            >
          </div>
        </div>
      {/if}
    </div>
  </div>

  {#if len(results) > 0}
    <ListBox
      bind:this={listboxRef}
      items={results}
      {selectionChanged}
      onclick={(item) => openItem(item)}
    >
      {#snippet renderItem(searchResult)}
        {@const hili = hilightText(searchResult.line, hiliRegExp)}
        <div class="ml-2 truncate">
          {@html hili}
        </div>
        <div class="grow"></div>
        <div
          class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap max-w-[24ch] truncate"
          title={searchResult.note}
        >
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
    class="flex justify-between text-gray-700 text-xs max-w-full dark:text-white dark:text-opacity-50 bg-gray-100 rounded-lg px-2 pt-1 pb-1.5 mt-2"
  >
    <div>Enter: start search</div>
  </div>
</div>

<style>
  @reference "../main.css";

  input {
    @apply bg-white px-2 py-1 border-1 border-gray-200 outline-1 outline-gray-200;
  }
  button {
    @apply px-[6px] py-[2px] hover:bg-gray-200;
  }
</style>
