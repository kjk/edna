<script>
  import { getScrollbarWidth, len, throwIf } from "../util.js";
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
  import { isMoving } from "../mouse-track.svelte.js";

  /** @type {{ 
    noteName: string,
    shortcut: string,
    selectNote: (name: string) => void,
  }} */
  let { noteName = "", shortcut = "", selectNote } = $props();

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
  });

  function selectItem(noteName) {
    selectNote(noteName);
  }
</script>

<div class="fixed top-0 flex flex-col z-10 mt-[-1px] bg-amber-200" {style}>
  <div
    class:moving={isMoving.moving}
    class="text-sm flex px-1 select-none bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 items-center border-b border-l rounded-bl-lg self-end showOnMouseMove"
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
  {#if len(quickAccessNotes) > 0}
    <div
      class:moving={isMoving.moving}
      class="flex flex-col self-end items-stretch px-2 py-[4px] text-xs bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 border rounded-lg mt-[01px] border-r-0 showOnMouseMove"
    >
      {#each quickAccessNotes as name (name)}
        <button
          onclick={() => selectItem(name)}
          class="text-right cursor-pointer pl-[6px] py-[1px] hover:bg-gray-100 dark:hover:bg-gray-500"
          title="open note '{name}'"
        >
          {name}
        </button>
      {/each}
    </div>
  {/if}
</div>

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
  .showOnMouseMove {
    visibility: hidden;
    &:where(.moving, :hover) {
      visibility: visible;
    }
  }
</style>
