<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { isSystemNoteName, sanitizeNoteName } from "../notes";

  interface Props {
    onclose: () => void;
    oldName: string;
    rename: (newName: string) => void;
  }
  let { oldName, onclose, rename }: Props = $props();

  // svelte-ignore state_referenced_locally
  let newName = $state(oldName);

  let sanitizedNewName = $derived.by(() => {
    return sanitizeNoteName(newName);
  });

  let canRename = $derived.by(() => {
    let name = sanitizedNewName;
    if (name === "" || name === oldName) {
      return false;
    }
    if (isSystemNoteName(name)) {
      return false;
    }
    let noteNames = appState.allNotes;
    return !noteNames.includes(name);
  });

  let renameError = $derived.by(() => {
    let name = sanitizedNewName;
    if (name === "") {
      return "name cannot be empty";
    }
    let noteNames = appState.allNotes;
    if (noteNames.includes(name)) {
      return `note <span class="font-bold">${name}</span> already exists`;
    }
    return "";
  });

  function onkeydown(ev: KeyboardEvent) {
    let key = ev.key;

    if (canRename && key === "Enter") {
      emitRename();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
  }

  function emitRename() {
    rename(sanitizedNewName);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="0"
  {onkeydown}
  class="selector z-20 absolute center-x-with-translate top-[4rem] flex flex-col max-w-full p-3"
>
  <div class="flex">
    <div class="text-lg font-semibold grow">
      Rename <span class="font-bold">{oldName}</span> to:
    </div>
    <button onclick={() => onclose()} title="Close" class="kbd-btn">Esc</button>
  </div>
  <input bind:value={newName} use:focus class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]" />
  <div class=" text-sm mt-2">
    {#if canRename}
      New name: <span class="font-bold">{sanitizedNewName}</span>
    {:else}
      <span class="text-red-500">{@html renameError}</span>
    {/if}
  </div>
  <div class="flex justify-end mt-2">
    <button onclick={onclose} class="mr-4 button-outline">Cancel</button>
    <button onclick={() => emitRename()} disabled={!canRename} class="button-outline">Rename</button>
  </div>
</div>
