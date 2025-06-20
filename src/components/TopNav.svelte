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
  import { buildNoteInfos, sortNotes } from "./NoteSelector.svelte";

  /** @typedef {import("./NoteSelector.svelte").NoteInfo} NoteInfo} */

  /** @type {{ 
    noteName: string,
    selectNote: (name: string) => void,
  }} */
  let { noteName = "", selectNote } = $props();

  /**
   * @param {string} noteName
   * @returns {string}
   */
  function getNoteShortcut(noteName) {
    let altChar = getAltChar();
    let m = getNoteMeta(noteName);
    if (m && m.altShortcut) {
      return `${altChar} + ${m.altShortcut}`;
    }
    return "";
  }

  let shortcut = $derived(getNoteShortcut(noteName));

  /**
   * @param {string[]} starred
   * @param {string[]} history
   * @returns {NoteInfo[]}
   */
  function buildQuickAccessNotes(starred, history, withShortcuts) {
    /** @type {string[]} */
    let notes = [...starred, ...history, ...withShortcuts];
    // remove duplicate names in notes
    notes = [...new Set(notes)];
    let res = buildNoteInfos(notes);
    return res;
  }

  let quickAccessNotes = $derived(
    buildQuickAccessNotes(
      appState.starredNotes,
      appState.history,
      appState.withShortcuts,
    ),
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
      {@render IconCommandPalette()}
    </button>
  </div>
</div>

{#if len(quickAccessNotes) > 0}
  <div
    class="fixed top-[28px] z-10 text-sm bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 border rounded-lg mt-[01px] border-r-0 showOnHover"
    {style}
  >
    <table class="my-1">
      <tbody>
        {#each quickAccessNotes as noteInfo (noteInfo.key)}
          {@const shortcut = getNoteShortcut(noteInfo.name)}
          <tr
            class=" whitespace-nowrap cursor-pointer pl-[6px] py-[1px] hover:bg-gray-100 dark:hover:bg-gray-500 align-baseline"
            title="open note '{noteInfo.name}'"
            onclick={() => selectItem(noteInfo.name)}
          >
            <td class="pl-2 pr-2 text-right max-w-[32ch] truncate">
              {noteInfo.name}
            </td>
            <td class="text-xs px-2 text-gray-400 dark:text-gray-400">
              {shortcut}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
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
  .showOnMouseMove {
    visibility: hidden;
    &:where(.moving, :hover) {
      visibility: visible;
    }
  }
  .showOnHover {
    opacity: 0;
    &:where(:hover) {
      opacity: 1;
    }
  }
</style>
