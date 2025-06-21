<script>
  import { onMount, tick } from "svelte";
  import { focus } from "../actions";
  import { toggleNoteStarred } from "../metadata";
  import { getSettings } from "../settings.svelte";
  import { appState } from "../state.svelte";
  import {
    getAltChar,
    getKeyEventNumber,
    getModChar,
    getScrollbarWidth,
    len,
  } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildNoteInfo, buildNoteInfos } from "./NoteSelector.svelte";

  /** @type {{ 
    selectNote: (name: string) => void,
    forHistory: boolean,
  }} */
  let { forHistory, selectNote } = $props();

  let altChar = getAltChar();
  let modChar = getModChar();

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
    let dx = getScrollbarWidth() + 12;
    style = `right: ${dx}px`;
  });

  function selectItem(noteName) {
    selectNote(noteName);
    tick().then(() => {
      appState.showQuickAccess = 0;
    });
  }

  let cls = $derived(
    forHistory || appState.showQuickAccess > 0 ? "block" : "hidden",
  );

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

  /**
   * @param {NoteInfo} noteInfo
   */
  async function toggleStarred(noteInfo) {
    // there's a noticeable UI lag when we do the obvious:
    // item.isStarred = toggleNoteStarred(item.name);
    // because we wait until metadata file is saved
    // this version makes an optimistic change to reflect in UI
    // and, just to be extra sure, reflects the state after saving
    noteInfo.isStarred = !noteInfo.isStarred;
    toggleNoteStarred(noteInfo.name).then((isStarred) => {
      // not really necessary, should be in-sync
      noteInfo.isStarred = isStarred;
    });
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  use:focus
  onmouseenter={() => appState.showQuickAccess++}
  onmouseleave={() => appState.showQuickAccess--}
  class="fixed top-[26px] pt-[4px] z-20 text-sm py-1 bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 border rounded-lg mt-[01px] focus:outline-hidden {cls}"
  {style}
>
  <ListBox
    bind:this={listbox}
    items={quickAccessNotes}
    onclick={(noteInfo) => selectItem(noteInfo.name)}
    {initialSelection}
    compact={true}
  >
    {#snippet renderItem(noteInfo, idx)}
      {@const shortcut = getNoteShortcut(noteInfo)}
      {@const cls = firstInHistoryIdx == idx ? "border-t" : ""}
      {@const historyTrigger = idx - firstInHistoryIdx}
      {#if forHistory && historyTrigger >= 0}
        <div class="px-1 grow text-gray-800 font-bold dark:text-gray-400 {cls}">
          {"" + historyTrigger}
        </div>
      {:else if shortcut}
        <div class="px-1 grow text-gray-400 dark:text-gray-400 {cls}">
          {shortcut}
        </div>
      {:else if noteInfo.isStarred && historyTrigger < 0}
        <button
          tabindex="-1"
          class="ml-[2px] cursor-pointer hover:text-yellow-600"
          onclick={(ev) => {
            toggleStarred(noteInfo);
            ev.preventDefault();
            ev.stopPropagation();
          }}
        >
          {@render IconTablerStar(
            noteInfo.isStarred ? "var(--color-yellow-300)" : "none",
          )}
        </button>
      {:else}
        <div class="px-1 grow text-gray-400 dark:text-gray-400 {cls}">
          &nbsp;
        </div>
      {/if}
      <div class="px-1 grow self-end text-right max-w-[32ch] truncate {cls}">
        {noteInfo.name}
      </div>
    {/snippet}
  </ListBox>
  {#if !forHistory}
    <div class="text-xs text-center text-gray-400 ml-2 mr-3 mt-1">
      tip: {modChar} + H
    </div>
  {/if}
</form>
