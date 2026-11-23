<script lang="ts">
  import { isSystemNoteName } from "../notes";
  import ListBox from "./ListBox.svelte";
  import { buildVisibleNoteInfos, NoteFilter, noteFilterInput, noteItemRow } from "./NoteSelector.svelte";
  import type { NoteInfo } from "./NoteSelector.svelte";

  interface Props {
    class?: string;
    openNote: (name: string, newTab: boolean) => void;
  }
  let { class: klass, openNote }: Props = $props();

  const nf = new NoteFilter(() => buildVisibleNoteInfos(), () => ({ openNote }));

  function sysNoteCls(note: NoteInfo): string {
    return isSystemNoteName(note.name) ? "italic" : "";
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={nf.onkeydown}
  tabindex="-1"
  class="flex flex-col w-[16em] p-2 text-sm h-full overflow-auto bg-white dark:bg-gray-900 dark:text-gray-300"
>
  {@render noteFilterInput(nf)}
  <ListBox
    bind:this={nf.listbox}
    items={nf.filtered}
    selectionChanged={nf.selectionChanged}
    onclick={(item, newTab) => nf.openNote(item, newTab)}
  >
    {#snippet renderItem(noteInfo)}
      {@render noteItemRow(noteInfo, nf, sysNoteCls(noteInfo))}
    {/snippet}
  </ListBox>
</form>
