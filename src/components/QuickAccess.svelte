<script>
  import { onMount } from "svelte";
  import { getNoteMeta } from "../metadata";
  import { appState } from "../state.svelte";
  import { getAltChar, getScrollbarWidth, len } from "../util";
  import { buildNoteInfos } from "./NoteSelector.svelte";

  /** @type {{ 
    selectNote: (name: string) => void,
  }} */
  let { selectNote } = $props();

  let altChar = getAltChar();

  /** @typedef {import("./NoteSelector.svelte").NoteInfo} NoteInfo} */
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

  let style = $state("");
  onMount(() => {
    let dx = getScrollbarWidth();
    style = `right: ${dx}px`;
  });

  function selectItem(noteName) {
    selectNote(noteName);
  }
</script>

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
  .showOnHover {
    opacity: 0;
    &:where(:hover) {
      opacity: 1;
    }
  }
</style>
