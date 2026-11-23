<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { getSettings } from "../settings.svelte";
  import { toggleNoteStarred } from "../metadata";
  import { getAltChar, getModChar, handleDigitPick, handleListKeydown, len, removeDuplicates } from "../util";
  import { StarButton } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildNoteInfo, buildNoteInfos, noteShortcutStr } from "./NoteSelector.svelte";
  import type { NoteInfo } from "./NoteSelector.svelte";

  interface Props {
    openNote: (name: string, newTab?: boolean) => void;
    forHistory: boolean;
  }
  let { forHistory, openNote }: Props = $props();

  let altChar = getAltChar();
  let modChar = getModChar();

  // svelte-ignore non_reactive_update
  let firstInHistoryIdx = -1;
  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  let listboxRef: ListBox;

  let settings = getSettings();

  const kMaxHistory = 10;

  function buildQuickAccessNotes(starred: string[], withShortcuts: string[], history: string[]): NoteInfo[] {
    let notes: string[] = [...starred, ...withShortcuts];
    notes = removeDuplicates(notes);
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
    buildQuickAccessNotes(appState.starredNotes, appState.withShortcuts, appState.history),
  );

  function onkeydown(ev: KeyboardEvent) {
    // "0" ... "9" picks a note from history
    let nHistory = len(quickAccessNotes) - firstInHistoryIdx;
    handleListKeydown(ev, listboxRef, true, (ev) =>
      handleDigitPick(ev, nHistory, (idx) => openNote(quickAccessNotes[firstInHistoryIdx + idx]!.name, ev.ctrlKey)),
    );

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
      {@const shortcut = noteShortcutStr(noteInfo)}
      {@const historyTrigger = idx - firstInHistoryIdx}
      {#if historyTrigger >= 0 && historyTrigger <= 9}
        <div class="px-1 grow text-gray-500 dark:text-gray-400">
          {"" + historyTrigger}
        </div>
      {:else if shortcut}
        <div class="px-1 whitespace-nowrap text-left grow text-gray-400 dark:text-gray-400 {cls}">
          {shortcut}
        </div>
      {:else if noteInfo.isStarred && historyTrigger < 0}
        {@render StarButton(noteInfo.isStarred, () => toggleNoteStarred(noteInfo.name), "ml-0.5")}
      {:else}
        <div class="px-1 grow text-gray-400 dark:text-gray-400 {cls}">&nbsp;</div>
      {/if}
      <div class="px-1 ml-4 grow self-end text-right max-w-[32ch] truncate {cls}">
        {noteInfo.name}
      </div>
    {/snippet}
  </ListBox>
  <div class="flex flex-col text-xs justify-between ml-2 mr-3 mt-2 text-gray-500">
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
    <a target="_blank" class="link self-center" href="/help#quick-access-ui-for-starred%2C-recent-notes">learn more</a>
  </div>
</form>
