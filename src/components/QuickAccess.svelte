<script>
  import { onMount } from "svelte";
  import { getNoteMeta } from "../metadata";
  import { appState } from "../state.svelte";
  import { getAltChar, getScrollbarWidth, len } from "../util";
  import { buildNoteInfo, buildNoteInfos } from "./NoteSelector.svelte";

  /** @type {{ 
    selectNote: (name: string) => void,
  }} */
  let { selectNote } = $props();

  let altChar = getAltChar();

  let fistInHistoryIdx;

  /** @typedef {import("./NoteSelector.svelte").NoteInfo} NoteInfo} */
  /**
   * @param {string[]} starred
   * @param {string[]} history
   * @returns {NoteInfo[]}
   */
  function buildQuickAccessNotes(starred, withShortcuts, history) {
    /** @type {string[]} */
    let notes = [...starred, ...withShortcuts];
    // remove duplicate names in notes
    notes = [...new Set(notes)];
    let res = buildNoteInfos(notes);
    fistInHistoryIdx = len(res);
    // history can repeat the names
    for (let noteName of history) {
      let item = buildNoteInfo(noteName);
      item.altShortcut = 0;
      res.push(item);
    }
    return res;
  }

  let quickAccessNotes = $derived(
    buildQuickAccessNotes(
      appState.starredNotes,
      appState.withShortcuts,
      appState.history,
    ),
  );

  /**
   * @param {NoteInfo} note
   * @returns {string}
   */
  function getNoteShortcut(note) {
    if (note.altShortcut) {
      return `${altChar} + ${note.altShortcut}`;
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
        {#each quickAccessNotes as noteInfo, idx (noteInfo.key)}
          {@const shortcut = getNoteShortcut(noteInfo)}
          {@const cls = fistInHistoryIdx == idx ? "border-t" : ""}
          <tr
            class=" whitespace-nowrap cursor-pointer pl-[6px] py-[1px] hover:bg-gray-100 dark:hover:bg-gray-500 align-baseline {cls}"
            title="open note '{noteInfo.name}'"
            onclick={() => selectItem(noteInfo.name)}
          >
            <td class="text-xs px-2 text-gray-400 dark:text-gray-400">
              {shortcut}
            </td>
            <td class="pl-2 pr-2 text-right max-w-[32ch] truncate">
              {noteInfo.name}
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
