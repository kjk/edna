<script>
  import { onMount } from "svelte";
  import { focus, trapfocus } from "../actions";
  import { getScrollbarWidth } from "../util.js";
  import {
    setSearchQuery,
    SearchQuery,
    findNext,
    findPrevious,
    closeSearchPanel,
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

  $effect(() => {
    // console.log("searchTerm:", searchTerm);
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
    console.log("next");
    findNext(view);
  }
  function prev() {
    console.log("prev");
    findPrevious(view);
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
    isMoving.disableMoveTracking = true;
    return () => {
      isMoving.disableMoveTracking = false;
      closeSearchPanel(view);
    };
  });
</script>

<div
  class="fixed top-[2px] left-1/2 -translate-x-1/2 z-20 pl-2 py-0.5 bg-white border text-xs border-gray-400 rounded-sm max-w-4/5 flex flex-col"
  use:trapfocus
>
  <div class="flex">
    <input
      type="text"
      placeholder="Find"
      bind:value={searchTerm}
      class="w-[32ch]"
      use:focus
      onkeydown={onKeyDown}
    />
    <button onclick={next}>next</button>
    <button onclick={prev}>prev </button>
    <button onclick={prev}>all </button>
  </div>
  <div class="flex">
    <input
      type="text"
      placeholder="Replace"
      bind:value={replaceTerm}
      class="w-[32ch]"
    />
    <button>replace</button>
    <button class="grow">all</button>
  </div>
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
