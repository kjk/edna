<script>
  import { getScrollbarWidth, len } from "../util.js";
  import { appState } from "../state.svelte.js";
  import {
    openCommandPalette,
    openContextMenu,
    openNoteSelector,
  } from "../globals.js";
  import IconCommandPalette from "./IconCommandPalette.svelte";
  import { fixUpShortcuts } from "../key-helper.js";
  import { onMount } from "svelte";
  import IconMenu from "./IconMenu.svelte";

  /** @type {{ 
    noteName: string,
    shortcut: string,
    selectNote: (name: string) => void,
    showQuickNoteAccess: boolean,
  }} */
  let {
    noteName = "",
    shortcut = "",
    selectNote,
    showQuickNoteAccess,
  } = $props();

  /**
   * @param {string[]} starred
   * @param {string[]} history
   * @returns {string[]}
   */
  function buildQuickAccessNotes(starred, history) {
    /** @type {string[]} */
    let res = [...starred];
    let n = len(history);
    for (let i = 1; i < n; i++) {
      let noteName = history[i];
      if (!res.includes(noteName)) {
        res.push(noteName);
      }
    }
    return res;
  }

  let quickAccessNotes = $derived(
    buildQuickAccessNotes(appState.starredNotes, appState.history),
  );

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
      class="text-sm flex px-1 select-none dark:text-gray-300 border-gray-300 dark:border-gray-500 dark:bg-gray-700 items-center bg-white border-b border-l rounded-bl-lg self-end"
    >
      <button
        onclick={openContextMenu}
        class="clickable-icon mt-[3px]"
        title="open menu"
      >
        <IconMenu></IconMenu>
      </button>
      <div class="text-gray-400 px-1">&bull;</div>

      <button
        class="flex cursor-pointer pl-[6px] pr-[2px] py-[4px] hover:bg-gray-100 dark:hover:bg-gray-500 items-center"
        onclick={openNoteSelector}
        title={fixUpShortcuts("Open Another Note (Mod + P)")}
      >
        <div class="max-w-32 truncate">{noteName}</div>
        <div class="mt-[-2px]">&nbsp;⏷</div></button
      >
      {#if shortcut}
        <div
          class="text-gray-500 dark:text-gray-400 text-xs mx-0.5"
          title="This Note Quick Access Shortcut ({shortcut})"
        >
          {shortcut}
        </div>
      {/if}
      <div class="text-gray-400 px-1">&bull;</div>

      <button
        onclick={openCommandPalette}
        class="clickable-icon mt-[3px]"
        title={fixUpShortcuts("Command Palette (Mod + Shift + P)")}
      >
        <IconCommandPalette></IconCommandPalette>
      </button>
    </div>
    {#if showQuickNoteAccess && len(quickAccessNotes) > 0}
      <div
        class="flex flex-col self-end items-stretch pl-[4px] pr-1 text-xs text-gray-500 bg-white/5 hover:bg-white hover:border hover:rounded-bl-lg"
      >
        {#each quickAccessNotes as name (name)}
          <button
            onclick={() => selectItem(name)}
            class="truncate max-w-[32ch] text-right cursor-pointer pl-[6px] py-[1px] hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-500"
            title="open note '{name}'"
          >
            {name}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  @reference "../main.css";

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
