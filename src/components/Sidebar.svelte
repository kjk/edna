<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { reassignNoteShortcut, toggleNoteStarred } from "../metadata";
  import { isSystemNoteName, sanitizeNoteName } from "../notes";
  import { findMatchingItems, getAltChar, hilightText, isAltNumEvent, len, makeHilightRegExp } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildNoteInfos } from "./NoteSelector.svelte";
  import type { NoteInfo } from "./NoteSelector.svelte";

  interface Props {
    class?: string;
    openNote: (name: string, newTab: boolean) => void;
  }
  let { class: klass, openNote }: Props = $props();

  function localBuildNoteInfos(regular, archived) {
    let notes = [...regular];
    notes.push(...archived);
    let res = buildNoteInfos(notes);
    return res;
  }
  let noteInfos = $derived(
    localBuildNoteInfos(appState.regularNotes, appState.showingArchived ? appState.archivedNotes : []),
  );

  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = getAltChar();

  function reloadNotes() {
    console.log("reloadNotes");
    // actions like re-assigning quick access shortcut do
    // not modify appState.noteNames so we have to force
    // rebuilding of items
    noteInfos = localBuildNoteInfos(appState.regularNotes, appState.showingArchived ? appState.archivedNotes : []);
  }

  let sanitizedFilter = $derived.by(() => {
    return sanitizeNoteName(filter);
  });

  let filteredNoteInfos = $derived.by(() => {
    // we split the search term by space, the name of the note
    // must match all parts
    return findMatchingItems(noteInfos, sanitizedFilter, "nameLC");
  });

  let selectedNote: NoteInfo = $state(null);
  let selectedName = $state("");

  let notesCountMsg = $derived.by(() => {
    // $state(`${noteCount} notes`);
    let n = len(filteredNoteInfos);
    if (n === 0) {
      return ""; // don't obscure user entering new, long note name
    }
    let nItems = len(noteInfos);
    if (n === nItems) {
      return `${nItems} notes`;
    }
    return `${n} of ${nItems} notes`;
  });

  function selectionChanged(item, idx) {
    // console.log("selectionChanged:", $state.snapshot(item), idx);
    selectedNote = item;
    selectedName = item ? selectedNote.name : "";
  }

  function sysNoteCls(note: NoteInfo): string {
    return isSystemNoteName(note.name) ? "italic" : "";
  }

  function noteShortcut(note: NoteInfo): string {
    return note.altShortcut ? altChar + " + " + note.altShortcut : "";
  }

  async function onKeydown(ev: KeyboardEvent) {
    // console.log("onKeyDown:", event);
    let altN = isAltNumEvent(ev);
    if (altN !== null) {
      ev.preventDefault();
      let note = selectedNote;
      if (note) {
        await reassignNoteShortcut(note.name, altN).then(reloadNotes);
        return;
      }
    }
    let key = ev.key;

    if (key === "s" && ev.altKey && selectedNote) {
      toggleStarred(selectedNote);
      ev.preventDefault();
      return;
    }

    if (key === "Enter") {
      ev.preventDefault();
      // let name = sanitizedFilter;
      if (selectedNote) {
        emitOpenNote(selectedNote, false);
      }
      return;
    }

    listboxRef.onkeydown(ev, filter === "");
  }

  function emitOpenNote(noteInfo: NoteInfo, newTab: boolean) {
    // console.log("emitOpenNote", noteInfo.name, newTab);
    openNote(noteInfo.name, newTab);
  }

  async function toggleStarred(noteInfo: NoteInfo) {
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
    inputRef.focus();
  }

  /** HTMLElemnt */
  let inputRef;
  /** HTMLElemnt */
  let listboxRef;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="flex flex-col w-[16em] p-2 text-sm h-full overflow-auto bg-white dark:bg-gray-900 dark:text-gray-300"
>
  <div class="relative">
    <input
      type="text"
      use:focus
      bind:this={inputRef}
      bind:value={filter}
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-[0.5rem] top-[0.25rem] italic text-gray-400">
      {notesCountMsg}
    </div>
  </div>
  <ListBox
    bind:this={listboxRef}
    items={filteredNoteInfos}
    {selectionChanged}
    onclick={(item, ev) => emitOpenNote(item, ev.ctrlKey)}
  >
    {#snippet renderItem(noteInfo)}
      {@const hili = hilightText(noteInfo.name, hiliRegExp)}
      <button
        tabindex="-1"
        class="ml-[-6px] cursor-pointer hover:text-yellow-600"
        onclick={(ev) => {
          toggleStarred(noteInfo);
          ev.preventDefault();
          ev.stopPropagation();
        }}
      >
        {@render IconTablerStar(noteInfo.isStarred ? "var(--color-yellow-300)" : "none")}
      </button>
      <div class="ml-2 truncate {sysNoteCls(noteInfo) ? 'italic' : ''}">
        {@html hili}
      </div>
      <div class="grow"></div>
      <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">
        {noteShortcut(noteInfo)}
      </div>
    {/snippet}
  </ListBox>
</form>
