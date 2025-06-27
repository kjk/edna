<script>
  import { openCommandPalette, openContextMenu } from "../globals.js";
  import { fixUpShortcuts } from "../key-helper.js";
  import { getNoteMeta } from "../metadata.js";
  import { isMoving } from "../mouse-track.svelte.js";
  import { getSettings } from "../settings.svelte.js";
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

  // hack: ListBox is a child of the button shown when on hover
  // click in ListBox (selection of the note) propagates to parent
  // button and triggers opening command palette
  // so we ignore click after mySelectNote is called
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

  let settings = getSettings();
  let showingQuickAccess = $state(false);
  let cls = $derived.by(() => {
    if (settings.alwaysShowTopNav) {
      return "bg-white";
    }
    if (isMoving.moving) {
      return "visible fixed top-0 z-10 right-0 border-l rounded-lg";
    }
    return "invisible fixed top-0 z-10 right-0 border-l rounded-lg";
  });
</script>

<div
  class="flex bg-white text-sm px-1 select-none text-gray-900 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 items-center border-b {cls} hover:visible"
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
  {#if settings.alwaysShowTopNav}
    <div class="grow"></div>
    <a
      class="mr-2 font-bold text-blue-600 hover:text-blue-800"
      href="/help"
      target="_blank">Edna</a
    >
  {/if}
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
