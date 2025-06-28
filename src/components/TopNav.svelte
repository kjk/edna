<script>
  import {
    focusEditor,
    openCommandPalette,
    openContextMenu,
    openNoteSelector,
  } from "../globals.js";
  import { fixUpShortcuts } from "../key-helper.js";
  import { getNoteMeta } from "../metadata.js";
  import { isMoving } from "../mouse-track.svelte.js";
  import { getSettings } from "../settings.svelte.js";
  import { getAltChar } from "../util.js";
  import {
    IconCommandPalette,
    IconMdiArrowCollapseLeft,
    IconMdiArrowCollapseRight,
    IconMenu,
    IconTablerPlus,
  } from "./Icons.svelte";
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

  function mySelectNote(item) {
    showingQuickAccess = false;
    selectNote(item);
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onmouseenter={() => (showingQuickAccess = true)}
    onmouseleave={() => {
      showingQuickAccess = false;
      focusEditor();
    }}
    class="clickable-icon mt-[-2px] relative"
  >
    &nbsp;⏷
    {#if showingQuickAccess}
      <QuickAccess selectNote={mySelectNote} forHistory={false} />
    {/if}
  </div>

  <button
    class="flex bg-white align-baseline cursor-pointer clickable-icon hover:bg-gray-100 dark:hover:bg-gray-500 items-center border-b border-l border-r rounded-b-lg"
    onclick={openNoteSelector}
    title={fixUpShortcuts("Click To Open Another Note (Mod + K)")}
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
  </button>

  <!-- <button
    onclick={openNoteSelector}
    class="clickable-icon ml-1 px-1!"
    title={"Open note in a new tab"}
  >
    {@render IconTablerPlus()}
  </button> -->

  {#if settings.alwaysShowTopNav}
    <div class="grow"></div>
    <a
      class="mr-2 font-bold text-slate-600 hover:text-slate-800"
      href="/help"
      target="_blank">Edna</a
    >
    <button
      onclick={() => (settings.alwaysShowTopNav = false)}
      class="clickable-icon"
      title={"minimize"}
    >
      {@render IconMdiArrowCollapseRight()}
    </button>
  {:else}
    <button
      onclick={() => (settings.alwaysShowTopNav = true)}
      class="clickable-icon"
      title={"maximize"}
    >
      {@render IconMdiArrowCollapseLeft()}
    </button>
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
