<script>
  import { onMount, tick } from "svelte";
  import { focus, trapfocus } from "../actions";
  import {
    IconTablerArrowDown,
    IconTablerArrowUp,
    IconLucideReplace,
    IconLucideReplaceAll,
    IconTablerX,
    IconLucideTextSelect,
    IconTablerChevronDown,
    IconTablerChevronUp,
  } from "./Icons.svelte";
  import {
    setSearchQuery,
    SearchQuery,
    findNext,
    findPrevious,
    closeSearchPanel,
    selectMatches,
    getSearchQuery,
    replaceNext,
    replaceAll,
  } from "@codemirror/search";
  import { isMoving } from "../mouse-track.svelte";

  /** @typedef {import("@codemirror/view").EditorView} EditorView */
  /** @type {{
    view: EditorView
   }}
   */
  let { view } = $props();

  let searchTerm = $state("");
  let replaceTerm = $state("");
  let showReplace = $state(false);

  $effect(() => {
    let query = new SearchQuery({
      search: searchTerm,
      caseSensitive: false,
      literal: true,
    });
    view.dispatch({
      effects: setSearchQuery.of(query),
    });
  });

  function next() {
    findNext(view);
  }

  function prev() {
    findPrevious(view);
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
    searchInput.focus();
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

  let query = getSearchQuery(view.state);
  searchTerm = query.search;

  /** @type {HTMLInputElement} */
  let searchInput;

  onMount(() => {
    tick().then(() => {
      searchInput.select();
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
</script>

<div
  class="fixed top-[2px] left-1/2 -translate-x-1/2 z-20 pl-2 py-0.5 bg-white border text-sm border-gray-400 rounded-sm max-w-4/5 flex flex-col"
  use:trapfocus
>
  <div class="flex">
    <input
      bind:this={searchInput}
      type="text"
      spellcheck="false"
      placeholder="Find"
      bind:value={searchTerm}
      class="w-[32ch]"
      use:focus
      onkeydown={onKeyDown}
    />
    <button onclick={next} title="find next (Enter}"
      >{@render IconTablerArrowDown()}</button
    >
    <button onclick={prev} title="find previous (Shift + Enter)"
      >{@render IconTablerArrowUp()}</button
    >
    <button onclick={all} title="find all"
      >{@render IconLucideTextSelect()}</button
    >
    {#if showReplace}
      <button onclick={toggleShowReplace} title="hide replace"
        >{@render IconTablerChevronUp()}</button
      >
    {:else}
      <button onclick={toggleShowReplace} title="show replace"
        >{@render IconTablerChevronDown()}</button
      >
    {/if}
    <button onclick={close} title="close">{@render IconTablerX()}</button>
  </div>
  {#if showReplace}
    <div class="flex">
      <input
        type="text"
        spellcheck="false"
        placeholder="Replace"
        bind:value={replaceTerm}
        class="grow"
      />
      <button title="replace" onclick={replace}
        >{@render IconLucideReplace()}</button
      >
      <button title="replace all" onclick={_replaceAll}
        >{@render IconLucideReplaceAll()}</button
      >
    </div>
  {/if}
</div>

<style>
  @reference "../main.css";

  input {
    @apply border-none outline-none;
  }
  button {
    @apply px-[6px] py-[2px] hover:bg-gray-200;
  }
</style>
