<script>
  import { onMount } from "svelte";
  import { focus } from "../actions";
  import { appState } from "../state.svelte";
  import {
    getAltChar,
    getKeyEventNumber,
    getScrollbarWidth,
    len,
  } from "../util";
  import ListBox from "./ListBox.svelte";
  import { buildNoteInfo, buildNoteInfos } from "./NoteSelector.svelte";

  /** @type {{ 
    selectNote: (name: string) => void,
    forHistory: boolean,
  }} */
  let { forHistory, selectNote } = $props();

  let altChar = getAltChar();

  // svelte-ignore non_reactive_update
  let firstInHistoryIdx = -1;
  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  let listbox;

  console.log("QuickAcess, forHistory:", forHistory);

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
    firstInHistoryIdx = len(res);
    initialSelection = firstInHistoryIdx;
    if (len(history) > 1) {
      initialSelection++;
    }
    console.log("firstInHistoryIdx:", firstInHistoryIdx);
    console.log("initialSelection:", initialSelection);

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
  let cls = forHistory ? "opacity-100" : "showOnHover";
  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    if (forHistory) {
      // '0' ... '9' picks an item
      let idx = getKeyEventNumber(ev);
      let lastIdx = len(history) - 1;
      if (idx >= 0 && idx <= lastIdx) {
        ev.preventDefault();
        let item = quickAccessNotes[firstInHistoryIdx + idx];
        selectItem(item.name);
        return;
      }
    }

    listbox.onkeydown(ev, true);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  use:focus
  class="fixed top-[28px] z-20 text-xs py-0 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 border rounded-lg mt-[01px] border-r-0 focus:outline-hidden {cls}"
  {style}
>
  <ListBox
    bind:this={listbox}
    items={quickAccessNotes}
    onclick={(noteInfo) => selectItem(noteInfo.name)}
    {initialSelection}
  >
    {#snippet renderItem(noteInfo, idx)}
      {@const shortcut = getNoteShortcut(noteInfo)}
      {@const cls = firstInHistoryIdx == idx ? "border-t" : ""}
      {@const historyTrigger = idx - firstInHistoryIdx}
      {#if forHistory && historyTrigger >= 0}
        <div class="px-2 grow text-gray-800 font-bold dark:text-gray-400 {cls}">
          {"" + historyTrigger}
        </div>
      {:else}
        <div class="px-2 grow text-gray-400 dark:text-gray-400 {cls}">
          {shortcut}&nbsp;
        </div>
      {/if}
      <div class="px-2 grow self-end text-right max-w-[32ch] truncate {cls}">
        {noteInfo.name}
      </div>
    {/snippet}
  </ListBox>
</form>

<style>
  :global(.showOnHover) {
    opacity: 0;
    &:where(:hover) {
      opacity: 1;
    }
  }
</style>
