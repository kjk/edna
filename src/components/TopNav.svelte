<script>
  import { getScrollbarWidth, len } from "../util.js";
  import { appState } from "../state.svelte.js";
  import { openCommandPalette, openNoteSelector } from "../globals.js";
  import IconCommandPalette from "./IconCommandPalette.svelte";
  import { fixUpShortcuts } from "../key-helper.js";
  import { onMount } from "svelte";

  /** @type {{ 
    noteName: string,
    shortcut: string,
    selectNote: (name: string) => void,
  }} */
  let { noteName = "", shortcut = "", selectNote } = $props();

  /**
   * @typedef {Object} HistoryItem
   * @property {string} name
   * @property {string} nameLC
   * @property {string} key
   * @property {HTMLElement} ref
   */

  let history = appState.history;

  /**
   * @returns {HistoryItem[]}
   */
  function buildItems(history) {
    let n = len(history);
    if (n < 2) {
      return [];
    }
    /** @type {HistoryItem[]} */
    let res = Array(n - 1);
    for (let i = 1; i < n; i++) {
      let el = history[i];
      res[i - 1] = {
        key: el,
        name: el,
        nameLC: el.toLowerCase(),
        ref: null,
      };
    }
    return res;
  }

  let items = $derived(buildItems(history));

  let style = $state("");
  onMount(() => {
    let dx = getScrollbarWidth();
    style = `right: ${dx}px`;
    console.log("style: ", style);
  });

  function selectItem(noteName) {
    selectNote(noteName);
  }
</script>

{#if !appState.isDirtyFast}
  <div class="fixed top-0 flex flex-col z-10 mt-[-1px]" {style}>
    <div
      class="text-sm flex px-1 select-none dark:text-gray-300 border-gray-300 dark:border-gray-500 dark:bg-gray-700 items-center bg-white border-b border-l rounded-bl-lg"
    >
      <button
        class="cursor-pointer pl-[6px] pr-[2px] py-[4px] hover:bg-gray-100 dark:hover:bg-gray-500"
        onclick={openNoteSelector}
        title={fixUpShortcuts("Open Another Note (Mod + P)")}
      >
        <span class="max-w-32 truncate">{noteName}</span> ⏷</button
      >
      {#if shortcut}
        <div
          class="text-gray-500 dark:text-gray-400 text-xs mx-0.5"
          title="This Note Quick Access Shortcut ({shortcut})"
        >
          {shortcut}
        </div>
      {/if}

      <button
        onclick={openCommandPalette}
        class="clickable-icon"
        title={fixUpShortcuts("Command Palette (Mod + Shift + P)")}
      >
        <IconCommandPalette></IconCommandPalette>
      </button>

      <a class="clickable" href="/help" title="Documentation" target="_blank"
        >?</a
      >
    </div>
    {#if false}
      <div class="flex flex-col items-end py-[2px] text-xs my-[-2px]">
        {#each items as item (item.key)}
          <button
            onclick={() => selectItem(item.name)}
            class="truncate text-right cursor-pointer pl-[6px] pr-[2px] py-[1px] hover:font-bold dark:hover:bg-gray-500 bg-white"
            >{item.name}</button
          >
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  @reference "../main.css";

  .clickable,
  .clickable-icon {
    @apply cursor-pointer px-[6px] py-[4px];

    &:hover {
      @apply bg-gray-100 dark:bg-gray-500;
    }
  }

  .clickable-icon {
    @apply px-[4px];
  }
</style>
