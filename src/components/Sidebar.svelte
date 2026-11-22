<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { reassignNoteShortcut, toggleNoteStarred } from "../metadata";
  import { isSystemNoteName, sanitizeNoteName } from "../notes";
  import { findMatchingItems, getAltChar, hilightText, isAltNumEvent, len, makeHilightRegExp } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildRegularAndArchivedNoteInfos, noteShortcutStr } from "./NoteSelector.svelte";
  import type { NoteInfo } from "./NoteSelector.svelte";

  interface Props {
    class?: string;
    openNote: (name: string, newTab: boolean) => void;
  }
  let { class: klass, openNote }: Props = $props();

  let noteInfos = $derived(
    buildRegularAndArchivedNoteInfos(appState.regularNotes, appState.showingArchived ? appState.archivedNotes : []),
  );

  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let altChar = getAltChar();

  let sanitizedFilter = $derived.by(() => {
    return sanitizeNoteName(filter);
  });

  let filteredNoteInfos = $derived.by(() => {
    // we split the search term by space, the name of the note
    // must match all parts
    return findMatchingItems(noteInfos, sanitizedFilter, "nameLC");
  });

  let selectedNote: NoteInfo | undefined = $state();
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

  function selectionChanged(item: any, idx: number) {
    // console.log("selectionChanged:", $state.snapshot(item), idx);
    selectedNote = item;
    selectedName = selectedNote ? selectedNote.name : "";
  }

  function sysNoteCls(note: NoteInfo): string {
    return isSystemNoteName(note.name) ? "italic" : "";
  }

  async function onKeydown(ev: KeyboardEvent) {
    // console.log("onKeyDown:", event);
    let altN = isAltNumEvent(ev);
    if (altN !== null) {
      ev.preventDefault();
      let note = selectedNote;
      if (note) {
        await reassignNoteShortcut(note.name, altN);
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

    listboxComp.onkeydown(ev, filter === "");
  }

  function emitOpenNote(noteInfo: NoteInfo, newTab: boolean) {
    // console.log("emitOpenNote", noteInfo.name, newTab);
    openNote(noteInfo.name, newTab);
  }

  async function toggleStarred(noteInfo: NoteInfo) {
    // note: UI is updated via updateAfterNoteStateChange() after metadata is saved
    await toggleNoteStarred(noteInfo.name);
    inputRef.focus();
  }

  let inputRef: HTMLElement;
  let listboxComp: ListBox;
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
    <div class="absolute right-2 top-1 italic text-gray-400">
      {notesCountMsg}
    </div>
  </div>
  <ListBox
    bind:this={listboxComp}
    items={filteredNoteInfos}
    {selectionChanged}
    onclick={(item, newTab) => emitOpenNote(item, newTab)}
  >
    {#snippet renderItem(noteInfo)}
      {@const hili = hilightText(noteInfo.name, hiliRegExp)}
      <button
        tabindex="-1"
        class="-ml-1.5 cursor-pointer hover:text-yellow-600"
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
        {noteShortcutStr(noteInfo)}
      </div>
    {/snippet}
  </ListBox>
</form>
