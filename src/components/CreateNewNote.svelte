<script lang="ts">
  import { focus } from "../actions";
  import { findNoteIgnoreCase, sanitizeNoteName } from "../notes";
  import { noteNameError } from "../note-name";
  import { escapeHTML } from "../util";

  interface Props {
    onclose: () => void;
    createNewNote: (newName: string) => void;
  }
  let { onclose, createNewNote }: Props = $props();

  let newName = $state("");

  let canCreate = $derived.by(() => {
    let name = sanitizeNoteName(newName);
    if (noteNameError(name)) {
      return false;
    }
    return !findNoteIgnoreCase(name);
  });

  let createError = $derived.by(() => {
    let name = sanitizeNoteName(newName);
    let nameErr = noteNameError(name);
    if (nameErr) {
      return escapeHTML(nameErr);
    }
    let existing = findNoteIgnoreCase(name);
    if (existing) {
      return `note <span class="font-bold">${escapeHTML(existing)}</span> already exists`;
    }
    return "";
  });

  function onkeydown(ev: KeyboardEvent) {
    let key = ev.key;

    if (canCreate && key === "Enter") {
      emitCreate();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
  }

  function emitCreate() {
    let name = sanitizeNoteName(newName);
    createNewNote(name);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="0"
  {onkeydown}
  class="dlg z-20 absolute center-x-with-translate top-16 flex flex-col max-w-full p-3"
>
  <div class="text-lg font-semibold ml-1">Create new note</div>
  <input bind:value={newName} use:focus class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]" />
  <div class=" text-sm mt-2">
    {#if canCreate}
      &nbsp;
    {:else}
      <span class="text-red-500">{@html createError}</span>
    {/if}
  </div>
  <div class="flex justify-end mt-2">
    <button onclick={() => emitCreate()} disabled={!canCreate} class="button-outline">Create</button>
    <button onclick={onclose} class="ml-2 button-outline">Cancel</button>
  </div>
</div>
