<script>
  import { getLatestNoteNames, sanitizeNoteName } from "../notes";
  /** @type { {
    oldName: string,
    close: () => void,
    rename: (newName: string) => void,
}}*/
  let { oldName, close, rename } = $props();

  let newName = $state(oldName);

  /** @type {HTMLElement} */
  let container;
  /** @type {HTMLElement} */
  let input = $state(null);

  $effect(() => {
    if (input) {
      input.focus();
    }
  });

  let sanitizedNewName = $derived.by(() => {
    return sanitizeNoteName(newName);
  });

  let canRename = $derived.by(() => {
    let name = sanitizedNewName;
    if (name === "" || name === oldName) {
      return false;
    }
    let noteNames = getLatestNoteNames();
    return !noteNames.includes(name);
  });

  $effect(() => {
    console.log("canRename:", canRename);
  });

  let renameError = $derived.by(() => {
    let name = sanitizedNewName;
    if (name === "") {
      return "name cannot be empty";
    }
    let noteNames = getLatestNoteNames();
    if (noteNames.includes(name)) {
      return "name already exists";
    }
    return "";
  });

  /**
   * @param {KeyboardEvent} event
   */
  function onKeydown(event) {
    let key = event.key;

    if (key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }

    if (canRename && key === "Enter") {
      emitRename();
      return;
    }
  }

  function onFocusOut(event) {
    if (
      container !== event.relatedTarget &&
      !container.contains(event.relatedTarget)
    ) {
      close();
    }
  }

  function emitRename() {
    rename(sanitizedNewName);
  }
</script>

<div class="fixed inset-0">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form
    bind:this={container}
    onkeydown={onKeydown}
    onfocusout={onFocusOut}
    tabindex="-1"
    class="selector absolute center-x-with-translate top-[4rem] z-20 flex flex-col max-w-full p-3"
  >
    <div>Rename <span class="font-bold">{oldName}</span> to:</div>
    <input
      bind:this={input}
      bind:value={newName}
      class="py-1 px-2 bg-white mt-2 rounded-sm w-[80ch]"
    />
    <div class=" text-sm mt-2">
      New name: <span class="font-bold">"{sanitizedNewName}"</span>
      {#if !canRename}
        <span class="text-red-500 font-bold">{renameError}</span>
      {/if}
    </div>
    <div class="flex justify-end mt-2">
      <button
        onclick={() => close()}
        class="mr-4 px-4 py-1 border border-black hover:bg-gray-100"
        >Cancel</button
      >
      <button
        onclick={() => emitRename()}
        disabled={!canRename}
        class="px-4 py-1 border border-black hover:bg-gray-50 disabled:text-gray-400 disabled:border-gray-400 default:bg-slate-700"
        >Rename</button
      >
    </div>
  </form>
  <div class="bg-black opacity-50 absolute inset-0 z-10"></div>
</div>