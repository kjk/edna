<script>
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { toggleNoteStarred } from "../metadata";
  import { getSettings } from "../settings.svelte";
  import { getAltChar, getKeyEventNumber, getModChar, len } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildNoteInfo, buildNoteInfos } from "./NoteSelector.svelte";

  /** @type {{
    openNote: (name: string, newTab?: boolean) => void,
    forHistory: boolean,
  }} */
  let { forHistory, openNote } = $props();

  let altChar = getAltChar();
  let modChar = getModChar();

  // svelte-ignore non_reactive_update
  let firstInHistoryIdx = -1;
  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  let listboxRef;

  let settings = getSettings();

  const kMaxHistory = 10;

  /**
   * @typedef {import("./NoteSelector.svelte").NoteInfo} NoteInfo }
   * @param {string[]} starred
   * @param {string[]} withShortcuts
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

    let n = Math.min(len(history), kMaxHistory);
    // history can repeat the names
    for (let i = 0; i < n; i++) {
      let noteName = history[i];
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

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    // '0' ... '9' picks an item
    let idx = getKeyEventNumber(ev);
    let lastIdx = len(history) - 1;
    if (idx >= 0 && idx <= lastIdx) {
      ev.preventDefault();
      let item = quickAccessNotes[firstInHistoryIdx + idx];
      openNote(item.name, ev.ctrlKey);
      return;
    }

    listboxRef.onkeydown(ev, true);
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
  // if forHistory, showing in absolute position inside overlay
  // otherwise is absolute child of relative parent
  let cls = $derived.by(() => {
    if (forHistory) {
      return "z-20 top-[2rem] center-x-with-translate";
    }
    if (settings.alwaysShowTopNav) {
      return "top-full border border-gray-400 center-x-with-translate";
    }
    return "top-full border border-gray-400 right-0";
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  use:focus
  class="absolute flex flex-col pt-1 z-20 text-sm py-2 px-2 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-500 border rounded-lg focus:outline-hidden {cls}"
>
  <ListBox
    bind:this={listboxRef}
    items={quickAccessNotes}
    onclick={(noteInfo, metaPressed) => {
      openNote(noteInfo.name, metaPressed);
    }}
    {initialSelection}
    compact={true}
  >
    {#snippet renderItem(noteInfo, idx)}
      {@const shortcut = getNoteShortcut(noteInfo)}
      {@const cls = firstInHistoryIdx == idx ? "border-t-not-good-enough" : ""}
      {@const historyTrigger = idx - firstInHistoryIdx}
      {#if historyTrigger >= 0 && historyTrigger <= 9}
        <div class="px-1 grow text-gray-500 dark:text-gray-400 {cls}">
          {"" + historyTrigger}
        </div>
      {:else if shortcut}
        <div
          class="px-1 whitespace-nowrap text-left grow text-gray-400 dark:text-gray-400 {cls}"
        >
          {shortcut}
        </div>
      {:else if noteInfo.isStarred && historyTrigger < 0}
        <button
          tabindex="-1"
          class="ml-0.5 cursor-pointer hover:text-yellow-600"
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
      <div
        class="px-1 ml-4 grow self-end text-right max-w-[32ch] truncate {cls}"
      >
        {noteInfo.name}
      </div>
    {/snippet}
  </ListBox>
  <div
    class="flex flex-col text-xs justify-between ml-2 mr-3 mt-2 text-gray-500"
  >
    <div class="flex justify-between">
      <div>
        {modChar} + H
      </div>
      <div>show/hide me</div>
    </div>
    <div class="flex justify-between">
      <div>{modChar} + click</div>
      <div>open in new tab</div>
    </div>
    <a
      target="_blank"
      class="link self-center"
      href="/help#quick-access-ui-for-starred%2C-recent-notes">learn more</a
    >
  </div>
</form>
