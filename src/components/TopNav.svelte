<script>
  import { onMount } from "svelte";
  import {
    openCommandPalette,
    openContextMenu,
    openNoteSelector,
  } from "../globals.js";
  import { fixUpShortcuts } from "../key-helper.js";
  import { getNoteMeta } from "../metadata.js";
  import { isMoving } from "../mouse-track.svelte.js";
  import { appState } from "../state.svelte.js";
  import { getAltChar, getScrollbarWidth, len, throwIf } from "../util.js";
  import { IconCommandPalette, IconMenu } from "./Icons.svelte";

  /** @type {{ 
    noteName: string,
  }} */
  let { noteName = "" } = $props();

  let altChar = getAltChar();

  /**
   * @param {string} noteName
   * @returns {string}
   */
  function getNoteShortcut(noteName) {
    let m = getNoteMeta(noteName);
    if (m && m.altShortcut) {
      return `${altChar} + ${m.altShortcut}`;
    }
    return "";
  }

  let shortcut = $derived(getNoteShortcut(noteName));

  let style = $state("");
  onMount(() => {
    let dx = getScrollbarWidth();
    style = `right: ${dx}px`;
  });
  $effect(() => {
    // console.log("appState.showQuickAccess", appState.showQuickAccess);
    // TODO: this is hacky, should use standard CSS, make QuickAccess.svelte a child
    // of TopNav and show / hide based on CSS hover
    if (appState.showQuickAccess < 0) {
      appState.showQuickAccess = 0;
    }
  });
</script>

<div class="fixed top-0 flex flex-col z-10 mt-[-1px]" {style}>
  <div
    class:moving={isMoving.moving}
    class="text-sm flex px-1 select-none bg-white text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 items-center border-b border-l rounded-bl-lg self-end showOnMouseMove relative"
  >
    <button
      onclick={openContextMenu}
      class="clickable-icon mt-[3px]"
      title="open menu"
    >
      {@render IconMenu()}
    </button>
    <div class="text-gray-400 px-1">&bull;</div>

    <button
      class="flex align-baseline cursor-pointer pl-[6px] pr-[2px] py-[4px] hover:bg-gray-100 dark:hover:bg-gray-500 items-center"
      onclick={openNoteSelector}
      onmouseenter={() => appState.showQuickAccess++}
      onmouseleave={() => appState.showQuickAccess--}
      title={fixUpShortcuts("Open Another Note (Mod + P)")}
    >
      <div class="max-w-32 truncate">
        {noteName}
        {#if shortcut}
          <span
            class="text-gray-500 dark:text-gray-400 text-xs"
            title="This Note Quick Access Shortcut ({shortcut})"
          >
            {shortcut}
          </span>
        {/if}
      </div>
      <div class="mt-[-2px]">&nbsp;⏷</div></button
    >
    <div class="text-gray-400 px-1">&bull;</div>

    <button
      onclick={openCommandPalette}
      class="clickable-icon mt-[3px]"
      title={fixUpShortcuts("Command Palette (Mod + Shift + P)")}
    >
      {@render IconCommandPalette()}
    </button>
  </div>
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
