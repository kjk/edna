<script lang="ts">
  import { noteNameUnavailableHTML, sanitizeNoteName } from "../notes";
  import NoteNameDialog from "./NoteNameDialog.svelte";

  interface Props {
    onclose: () => void;
    oldName: string;
    rename: (newName: string) => void;
  }
  let { oldName, onclose, rename }: Props = $props();

  // svelte-ignore state_referenced_locally
  let newName = $state(oldName);

  let sanitizedNewName = $derived(sanitizeNoteName(newName));

  let renameError = $derived(noteNameUnavailableHTML(sanitizedNewName, oldName));

  let canRename = $derived(sanitizedNewName !== "" && sanitizedNewName !== oldName && renameError === "");

  function emitRename() {
    rename(sanitizedNewName);
  }
</script>

<NoteNameDialog bind:name={newName} errorHTML={renameError} canSubmit={canRename} submit={emitRename}>
  {#snippet header()}
    <div class="flex">
      <div class="text-lg font-semibold grow">
        Rename <span class="font-bold">{oldName}</span> to:
      </div>
      <button onclick={() => onclose()} title="Close" class="kbd-btn">Esc</button>
    </div>
  {/snippet}
  {#snippet status()}
    New name: <span class="font-bold">{sanitizedNewName}</span>
  {/snippet}
  {#snippet buttons()}
    <button onclick={onclose} class="mr-4 button-outline">Cancel</button>
    <button onclick={() => emitRename()} disabled={!canRename} class="button-outline">Rename</button>
  {/snippet}
</NoteNameDialog>
