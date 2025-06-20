<script>
  import { focus } from "../actions";
  import { appState } from "../state.svelte";
  import { getKeyEventNumber, len } from "../util";
  import ListBox from "./ListBox.svelte";
  import { buildNoteInfos } from "./NoteSelector.svelte";

  /** @type {{
    selectHistory: (name: string) => void,
}}*/
  let { selectHistory } = $props();

  let items = $state(buildNoteInfos(appState.history));

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    // '0' ... '9' picks an item
    let idx = getKeyEventNumber(ev);
    let lastIdx = len(items) - 1;
    if (idx >= 0 && idx <= lastIdx) {
      ev.preventDefault();
      let item = items[idx];
      selectItem(item.name);
      return;
    }

    listbox.onkeydown(ev, true);
  }

  function selectItem(noteName) {
    selectHistory(noteName);
  }
  let listbox;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  class="selector absolute z-20 center-x-with-translate max-h-[94vh] flex flex-col top-[2rem] p-2 focus:outline-hidden"
  tabindex="-1"
  use:focus
  {onkeydown}
>
  <div
    class="w-[400px] py-0.5 px-2 rounder-sm leading-5 mb-2 text-center dark:text-gray-400"
  >
    Recently opened
  </div>
  <ListBox
    bind:this={listbox}
    {items}
    onclick={(item) => selectItem(item.name)}
    initialSelection={1}
  >
    {#snippet renderItem(item, idx)}
      <div class="truncate">
        {item.name}
      </div>
      <div class="grow"></div>
      {#if idx < 10}
        <div class="ml-4 font-bold">{idx}</div>
      {/if}
    {/snippet}
  </ListBox>
</form>
