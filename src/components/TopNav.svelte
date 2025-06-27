<script>
  import {
    openCommandPalette,
    openContextMenu,
    openNoteSelector,
  } from "../globals.js";
  import { fixUpShortcuts } from "../key-helper.js";
  import { getNoteMeta } from "../metadata.js";
  import { getAltChar } from "../util.js";
  import { IconCommandPalette, IconMenu } from "./Icons.svelte";
  import QuickAccess from "./QuickAccess.svelte";

  /** @type {{ 
    noteName: string,
    selectNote: (name: string) => void,
  }} */
  let { selectNote, noteName = "" } = $props();

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

  let eatNextClick = false;
  function mySelectNote(item) {
    eatNextClick = true;
    showingQuickAccess = false;
    selectNote(item);
  }
  function myOnClick() {
    if (eatNextClick) {
      eatNextClick = false;
      return;
    }
    openCommandPalette();
  }

  let showingQuickAccess = $state(false);
</script>

<div
  class="text-sm flex px-1 select-none text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 items-center bg-gray-50 border-b"
>
  <button onclick={openContextMenu} class="clickable-icon" title="open menu">
    {@render IconMenu()}
  </button>

  <button
    onclick={openCommandPalette}
    class="clickable-icon"
    title={fixUpShortcuts("Command Palette (Mod + Shift + K)")}
  >
    {@render IconCommandPalette()}
  </button>
  <a
    class="clickable-icon px-4"
    href="/help"
    title="Documentation"
    target="_blank">?</a
  >
  <div class="text-gray-300 px-1">|</div>
  <button
    class="flex bg-white ml-2 align-baseline cursor-pointer clickable-icon hover:bg-gray-100 dark:hover:bg-gray-500 items-center border-b border-l border-r rounded-b-lg relative"
    onclick={myOnClick}
    onmouseenter={() => (showingQuickAccess = true)}
    onmouseleave={() => (showingQuickAccess = false)}
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
    <div class="mt-[-2px]">&nbsp;⏷</div>
    {#if showingQuickAccess}
      <QuickAccess selectNote={mySelectNote} forHistory={false} />
    {/if}
  </button>
  <div class="grow"></div>
  <a
    class="mr-2 font-bold text-blue-600 hover:text-blue-800"
    href="/help"
    target="_blank">Edna</a
  >
</div>

<style>
  @reference "../main.css";

  .clickable-icon {
    @apply cursor-pointer px-2 py-1;

    &:hover {
      @apply bg-gray-100 dark:bg-gray-500;
    }
  }
</style>
