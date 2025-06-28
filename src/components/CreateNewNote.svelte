<script>
  import { focus } from "../actions";
  import { sanitizeNoteName } from "../notes";
  import { appState } from "../state.svelte";

  /** @type { {
    onclose: () => void,
    createNewNote: (newName: string) => void,
}}*/
  let { onclose, createNewNote } = $props();

  let newName = $state("");

  let sanitizedNewName = $derived(sanitizeNoteName(newName));

  let canCreate = $derived.by(() => {
    let name = sanitizeNoteName(newName);
    if (name === "") {
      return false;
    }
    let noteNames = appState.noteNames;
    return !noteNames.includes(name);
  });

  let renameError = $derived.by(() => {
    let name = sanitizeNoteName(newName);
    console.log(`renameError: newName: '${newName}', name: '${name}`);
    if (name === "") {
      return "name cannot be empty";
    }
    let noteNames = appState.noteNames;
    if (noteNames.includes(name)) {
      console.log("already exists");
      return `note <span class="font-bold">${name}</span> already exists`;
    }
    return "";
  });

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
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
  class="selector z-20 absolute center-x-with-translate top-[4rem] flex flex-col max-w-full p-3"
>
  <div class="text-lg font-semibold ml-1">Create new note</div>
  <input
    bind:value={newName}
    use:focus
    class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]"
  />
  <div class=" text-sm mt-2">
    {#if canCreate}
      &nbsp;
    {:else}
      <span class="text-red-500">{@html renameError}</span>
    {/if}
  </div>
  <div class="flex justify-end mt-2">
    <button onclick={onclose} class="mr-4 button-outline">Cancel</button>
    <button onclick={() => emitCreate()} disabled={!canCreate} class=""
      >Create</button
    >
  </div>
</div>
