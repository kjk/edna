<script module lang="ts">
  export function closeFindPanel(view: EditorView) {
    isMoving.findPanelOpen = false;
    closeSearchPanel(view);
  }
</script>

<script lang="ts">
  import { onMount, tick } from "svelte";
  import { selectAfterTick } from "../mount-util";
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
  import type { EditorView, ViewUpdate } from "@codemirror/view";
  import { focus, trapfocus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { getActiveNoteBlock } from "../editor/block/block";
  import { isMoving } from "../mouse-track.svelte";
  import { btnPressedCls, handleEnter, toggleFlag } from "../util";
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

  interface Props {
    view: EditorView;
  }
  let { view }: Props = $props();

  let searchTerm = $state("");
  let replaceTerm = $state("");
  let showReplace = $state(false);

  // find / replace in the whole note, current block or selection (#79).
  // The block / selection is captured when picked because finding changes
  // the selection; it's mapped through edits (e.g. replacements)
  type Scope = "note" | "block" | "selection";
  let scope: Scope = $state("note");
  let scopeRange: { from: number; to: number } | null = null;
  // changed on each setScope() so that the query is re-created
  let scopeGen = $state(0);

  function setScope(s: Scope) {
    let state = view.state;
    scopeRange = null;
    if (s === "selection") {
      let { from, to } = state.selection.main;
      if (from === to) {
        // nothing selected: limit to the block
        s = "block";
      } else {
        scopeRange = { from, to };
      }
    }
    if (s === "block") {
      let block = getActiveNoteBlock(state);
      scopeRange = block ? { from: block.contentFrom, to: block.to } : null;
    }
    scope = s;
    scopeGen++;
    searchInputREf.focus();
  }

  let searchInputREf: HTMLInputElement;

  let replaceInputRef: HTMLInputElement | undefined = $state(undefined);

  // svelte-ignore state_referenced_locally
  let query = getSearchQuery(view.state);
  searchTerm = query.search;

  const kMaxCountOfMatches = 1000; // 9999 in extended-find-replace

  // stores [from, to] positions for all matches as flattened array
  let matchBuffer: number[] = [];

  function matcHBufferAdd(from: number, to: number) {
    matchBuffer.push(from, to);
  }

  function matchBufferGet(idx: number): { from: number; to: number } | null {
    idx = idx * 2;
    if (idx >= matchBuffer.length) {
      return null;
    }
    return {
      from: matchBuffer[idx]!,
      to: matchBuffer[idx + 1]!,
    };
  }
  function matchBufferReset() {
    matchBuffer.length = 0;
  }

  // counting matches scans the whole document so we debounce it
  let countTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleCountMatches(delayMs: number) {
    clearTimeout(countTimer);
    countTimer = setTimeout(() => {
      calcTotalCountOfMatches();
      updateCurrentMatchCount();
    }, delayMs);
  }

  $effect(() => {
    // re-create the query on each setScope()
    void scopeGen;
    let q = new SearchQuery({
      search: searchTerm,
      replace: replaceTerm,
      caseSensitive: appState.searchMatchCase,
      regexp: appState.searchRegex,
      wholeWord: appState.searchMatchWholeWord,
      literal: true,
      test:
        scope === "note"
          ? undefined
          : (_match, _state, from, to) => !scopeRange || (from >= scopeRange.from && to <= scopeRange.to),
    });
    if (!q.valid) {
      return;
    }

    query = q;
    view.dispatch({
      effects: setSearchQuery.of(query),
    });
    scheduleCountMatches(300);
  });

  let counter = $state({
    current: 1, // 1-based
    total: 0,
    exceed: false,
  });

  export function update(update: ViewUpdate) {
    if (update.docChanged) {
      if (scopeRange) {
        // text inserted at the edges (e.g. a replaced match) stays in scope
        scopeRange = {
          from: update.changes.mapPos(scopeRange.from, -1),
          to: update.changes.mapPos(scopeRange.to, 1),
        };
      }
      // positions of matches changed
      scheduleCountMatches(300);
    } else if (update.selectionSet) {
      updateCurrentMatchCount();
    }
  }

  function updateCurrentMatchCount() {
    let lastSelection = view.state.selection.ranges.at(-1);
    if (!lastSelection) return;
    let index = counter.current, // 1-based
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
      tick().then(() => replaceInputRef?.focus());
    } else {
      tick().then(() => searchInputREf.focus());
    }
  }

  function onKeyDown(ev: KeyboardEvent) {
    handleEnter(ev, () => (ev.shiftKey ? prev() : next()));
  }

  onMount(() => {
    selectAfterTick(() => searchInputREf);
    isMoving.findPanelOpen = true;

    return () => {
      // note: unmounted when the panel is closed or the editor is destroyed,
      // so must not dispatch to the view
      isMoving.findPanelOpen = false;
      clearTimeout(countTimer);
    };
  });

  function close() {
    closeFindPanel(view);
  }
  let matchCaseCls = $derived(btnPressedCls(appState.searchMatchCase));
  let matchWholeWordCls = $derived(btnPressedCls(appState.searchMatchWholeWord));
  let matchRegexCls = $derived(btnPressedCls(appState.searchRegex));
</script>

{#snippet InsideInput()}
  <div class="absolute right-1 top-1.5 flex">
    {#if counter.total}
      <div class="flex text-gray-300 ml-4 self-center whitespace-nowrap">
        {counter.current} of {counter.total}
      </div>
    {/if}
    <button class={matchCaseCls} onclick={() => toggleFlag(appState, "searchMatchCase")} title="Match Case">{@render IconTablerLetterCase()}</button>
    <button class={matchWholeWordCls} onclick={() => toggleFlag(appState, "searchMatchWholeWord")} title="Match Whole Word"
      >{@render IconFluentWholeWord()}</button
    >
    <button class={matchRegexCls} onclick={() => toggleFlag(appState, "searchRegex")} title="Match Regular Expression"
      >{@render IconTablerRegex()}</button
    >
  </div>
{/snippet}

{#snippet NextToInputButtons()}
  <button onclick={next} title="Find Next (Enter}" class="ml-2">{@render IconTablerArrowDown()}</button>
  <button onclick={prev} title="Find Previous (Shift + Enter)">{@render IconTablerArrowUp()}</button>
  <button onclick={all} title="Find All">{@render IconLucideTextSelect()}</button>
  <select
    class="scope"
    title="Find in the whole note, current block or selection"
    value={scope}
    onchange={(ev) => setScope((ev.currentTarget as HTMLSelectElement).value as Scope)}
  >
    <option value="note">in note</option>
    <option value="block">in block</option>
    <option value="selection">in selection</option>
  </select>
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
  class="dlg-colors fixed top-0.5 left-1/2 -translate-x-1/2 z-20 px-1 py-1 bg-white text-sm max-w-4/5 shadow-lg border border-gray-300 dark:border-gray-700"
  use:trapfocus
>
  <div class="flex flex-row">
    <div class="flex mr-1">
      {#if showReplace}
        <button onclick={toggleShowReplace} title="hide replace">{@render IconTablerChevronDown()}</button>
      {:else}
        <button onclick={toggleShowReplace} title="show replace">{@render IconTablerChevronRight()}</button>
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
            <button class="ml-2" title="replace" onclick={replace}>{@render IconLucideReplace()}</button>
            <button title="replace all" onclick={_replaceAll}>{@render IconLucideReplaceAll()}</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="postcss">
  @reference "../main.css";

  input {
    @apply find-input;
  }

  button {
    @apply find-btn;
  }

  .scope {
    @apply ml-1 px-1 text-xs bg-transparent border border-gray-300 dark:border-gray-600 rounded-xs;
  }
</style>
