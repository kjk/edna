<script lang="ts">
  import { noteNameUnavailableHTML, sanitizeNoteName } from "../notes";
  import NoteNameDialog from "./NoteNameDialog.svelte";

  interface Props {
    onclose: () => void;
    createNewNote: (newName: string) => void;
  }
  let { onclose, createNewNote }: Props = $props();

  let newName = $state("");

  let createError = $derived(noteNameUnavailableHTML(sanitizeNoteName(newName)));
  let canCreate = $derived(createError === "");

  function emitCreate() {
    let name = sanitizeNoteName(newName);
    createNewNote(name);
  }
</script>

<NoteNameDialog bind:name={newName} errorHTML={createError} canSubmit={canCreate} submit={emitCreate}>
  {#snippet header()}
    <div class="text-lg font-semibold ml-1">Create new note</div>
  {/snippet}
  {#snippet status()}
    &nbsp;
  {/snippet}
  {#snippet buttons()}
    <button onclick={() => emitCreate()} disabled={!canCreate} class="button-outline">Create</button>
    <button onclick={onclose} class="ml-2 button-outline">Cancel</button>
  {/snippet}
</NoteNameDialog>
