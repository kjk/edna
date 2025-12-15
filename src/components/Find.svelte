<script>
  import { onMount, tick, untrack } from "svelte";
  import {
    closeSearchPanel,
    findNext,
    findPrevious,
    getSearchQuery,
    replaceAll,
    replaceNext,
    SearchQuery,
    selectMatches,
    setSearchQuery,
  } from "@codemirror/search";
  import { focus, trapfocus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { isMoving } from "../mouse-track.svelte";
  import {
    IconFluentWholeWord,
    IconLucideReplace,
    IconLucideReplaceAll,
    IconLucideTextSelect,
    IconTablerArrowDown,
    IconTablerArrowUp,
    IconTablerChevronDown,
    IconTablerChevronRight,
    IconTablerLetterCase,
    IconTablerRegex,
    IconTablerX,
  } from "./Icons.svelte";

  /** @typedef {import("@codemirror/view").EditorView} EditorView */
  /** @type {{
    view: EditorView
   }}
   */
  let { view } = $props();

  let searchTerm = $state("");
  let replaceTerm = $state("");
  let showReplace = $state(false);

  /** @type {HTMLInputElement} */
  let searchInputREf;

  /** @type {HTMLInputElement} */
  let replaceInputRef = $state(undefined);

  // svelte-ignore state_referenced_locally
  let query = getSearchQuery(view.state);
  searchTerm = query.search;

  const kMaxCountOfMatches = 1000; // 9999 in extended-find-replace

  // stores [from, to] positions for all matches as flattened array
  /** @type {number[]} */
  let matchBuffer = [];
  /**
   * @param {number} from
   * @param {number} to
   */
  function matcHBufferAdd(from, to) {
    matchBuffer.push(from, to);
  }
  /**
   * @param {number} idx
   * @returns {{from: number, to:number}}
   */
  function matchBufferGet(idx) {
    idx = idx * 2;
    if (idx >= matchBuffer.length) {
      return null;
    }
    return {
      from: matchBuffer[idx],
      to: matchBuffer[idx + 1],
    };
  }
  function matchBufferReset() {
    matchBuffer.length = 0;
  }

  $effect(() => {
    console.log("new search query:", searchTerm, "replaceTerm:", replaceTerm);
    let q = new SearchQuery({
      search: searchTerm,
      replace: replaceTerm,
      caseSensitive: appState.searchMatchCase,
      regexp: appState.searchRegex,
      wholeWord: appState.searchMatchWholeWord,
      literal: true,
    });
    if (!q.valid) {
      return;
    }

    query = q;
    view.dispatch({
      effects: setSearchQuery.of(query),
    });
    setTimeout(() => {
      calcTotalCountOfMatches();
      updateCurrentMatchCount();
    }, 500);
  });

  let counter = $state({
    current: 1, // 1-based
    total: 0,
    exceed: false,
  });

  /**
   * Compare equality of this query with the another one.
   */
  function _compare(other) {
    let res = untrack(() => query.eq(other) && query.literal == other.literal);
    return res;
  }

  function _setQuery(q, internal) {
    console.log("_setQuery:", q);
  }

  export function update(update) {
    // console.log("find update", update);
    // let resetCounter = false;
    // // Search any effect that brings query update.
    // for (let tr of update.transactions)
    //   for (let effect of tr.effects) {
    //     if (effect.is(setSearchQuery) && !_compare(effect.value)) {
    //       _setQuery(effect.value, false);
    //       resetCounter = true;
    //     }
    //   }
    // if (update.docChanged) {
    //   resetCounter = true;
    // }
    // if (resetCounter) {
    //   calcTotalCountOfMatches();
    //   updateCurrentMatchCount();
    // }
    // // Listen for the user action/command that toggles this panel.
    // if (
    //   update.transactions.some((tr) => {
    //     let config = tr.annotation(searchPanelChange);
    //     if (config) {
    //       this.searchField.inputEl.select();
    //       if (config.showReplace == this.showReplace) return false;
    //       this.showReplace = config.showReplace;
    //       return true;
    //     }
    //     return false;
    //   })
    // ) {
    //   this._toggleReplaceEl();
    // }
  }

  function updateCurrentMatchCount() {
    let lastSelection = view.state.selection.ranges.at(-1),
      index = counter.current, // 1-based
      prevIndex = index,
      max = counter.total;

    if (!max) return;

    // Efficiently trace next current match from previous current match
    // position.
    let curMatch = matchBufferGet(index - 1);
    while (!curMatch || (curMatch.to <= lastSelection.from && index < max)) {
      counter.current = ++index;
      curMatch = matchBufferGet(index - 1);
    }

    if (prevIndex === counter.current) {
      while (curMatch && curMatch.from >= lastSelection.to) {
        counter.current = --index;
        curMatch = matchBufferGet(index - 1);
      }
    }
  }

  function calcTotalCountOfMatches() {
    matchBufferReset();
    counter = { total: 0, current: 1, exceed: false };
    if (!query.search || !query.valid) {
      return;
    }

    let cursor = query.getCursor(view.state);

    // Stopped when the cursor reached the end, or the total reached its
    // allowed amount.
    while (!cursor.next().done && counter.total < kMaxCountOfMatches) {
      counter.total++;
      // @ts-ignore
      let { from, to } = cursor.value;
      matcHBufferAdd(from, to);
    }

    // @ts-ignore
    if (!cursor.done) {
      counter.exceed = true;
    }
  }

  function next() {
    findNext(view);
    updateCurrentMatchCount();
  }

  function prev() {
    findPrevious(view);
    updateCurrentMatchCount();
  }

  function all() {
    selectMatches(view);
  }

  function replace() {
    replaceNext(view);
  }
  function _replaceAll() {
    replaceAll(view);
  }

  function toggleShowReplace() {
    showReplace = !showReplace;
    if (showReplace) {
      tick().then(() => replaceInputRef.focus());
    } else {
      tick().then(() => searchInputREf.focus());
    }
  }
  /**
   * @param {KeyboardEvent} ev
   */
  function onKeyDown(ev) {
    if (ev.key == "Enter") {
      if (ev.shiftKey) {
        prev();
      } else {
        next();
      }
      ev.preventDefault();
      return;
    }
  }

  onMount(() => {
    tick().then(() => {
      searchInputREf.select();
    });
    isMoving.disableMoveTracking = true;

    return () => {
      isMoving.disableMoveTracking = false;
      closeSearchPanel(view);
    };
  });

  function close() {
    isMoving.disableMoveTracking = false;
    closeSearchPanel(view);
  }
  function matchCase() {
    appState.searchMatchCase = !appState.searchMatchCase;
    console.log("matchCase", appState.searchMatchCase);
  }
  function matchWholeWOrd() {
    appState.searchMatchWholeWord = !appState.searchMatchWholeWord;
    console.log("matchWholeWOrd", appState.searchMatchWholeWord);
  }
  function matchRegex() {
    appState.searchRegex = !appState.searchRegex;
    console.log("matchRegex", appState.searchRegex);
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
  let matchRegexCls = $derived(btnPressedCls(appState.searchRegex));
</script>

{#snippet InsideInput()}
  <div class="absolute right-[0.25rem] top-[6px] flex">
    {#if counter.total}
      <div class="flex text-gray-300 ml-4 self-center whitespace-nowrap">
        {counter.current} of {counter.total}
      </div>
    {/if}
    <button class={matchCaseCls} onclick={matchCase} title="Match Case"
      >{@render IconTablerLetterCase()}</button
    >
    <button
      class={matchWholeWordCls}
      onclick={matchWholeWOrd}
      title="Match Whole Word">{@render IconFluentWholeWord()}</button
    >
    <button
      class={matchRegexCls}
      onclick={matchRegex}
      title="Match Regular Expression">{@render IconTablerRegex()}</button
    >
  </div>
{/snippet}

{#snippet NextToInputButtons()}
  <button onclick={next} title="Find Next (Enter}" class="ml-2"
    >{@render IconTablerArrowDown()}</button
  >
  <button onclick={prev} title="Find Previous (Shift + Enter)"
    >{@render IconTablerArrowUp()}</button
  >
  <button onclick={all} title="Find All"
    >{@render IconLucideTextSelect()}</button
  >
  <button onclick={close} title="Close">{@render IconTablerX()}</button>
{/snippet}

{#snippet InputTop()}
  <input
    bind:this={searchInputREf}
    type="text"
    spellcheck="false"
    placeholder="Find"
    bind:value={searchTerm}
    class="w-[42ch]"
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
    class="w-[42ch]"
  />
{/snippet}

<div
  class="selector-colors fixed top-[2px] left-1/2 -translate-x-1/2 z-20 px-1 py-1 bg-white text-sm max-w-4/5 shadow-lg border border-gray-300 dark:border-gray-700"
  use:trapfocus
>
  <div class="flex flex-row">
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

    <div class="flex flex-col">
      <div class="flex">
        <!-- top row -->
        <div class="relative">
          {@render InputTop()}
          {@render InsideInput()}
        </div>
        {@render NextToInputButtons()}
      </div>
      {#if showReplace}
        <div class="flex">
          <!-- bottom row -->
          <div class="flex mt-2">
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
</div>

<style>
  @reference "../main.css";

  input {
    @apply bg-white px-2 py-1 border-1 border-gray-200 dark:border-gray-600 outline-1 outline-gray-200 dark:outline-gray-600;
  }

  button {
    @apply px-[6px] py-[2px] hover:bg-gray-200 dark:hover:bg-gray-500 dark:bg-gray-900 border-0;
  }
</style>
