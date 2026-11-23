<script module lang="ts">
  // an item in a list of blocks or of headings in a block
  export interface Item {
    key: number;
    text: string;
    // nesting level, for showing headings as a tree
    indent?: number;
  }
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts" generics="T extends Item">
  import { focus } from "../actions";
  import { findMatchingItems, handleDigitPick, handleListKeydown, hilightText, len, makeHilightRegExp } from "../util";
  import ListBox from "./ListBox.svelte";

  interface Props {
    items: T[];
    onselect: (item: T) => void;
    initialSelection?: number;
    // what the items are, for "3 blocks"
    noun?: string;
  }
  let { items, onselect, initialSelection = 0, noun = "block" }: Props = $props();

  let filter: string = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));

  let countMsg = len(items) == 1 ? `1 ${noun}` : `${len(items)} ${noun}s`;

  interface ListItem {
    item: T;
    textLC: string;
    key: number;
  }

  let listItems: ListItem[] = items.map((item) => ({
    item,
    textLC: item.text.toLowerCase(),
    key: item.key,
  }));

  let itemsFiltered: ListItem[] = $derived(findMatchingItems(listItems, filter, "textLC"));

  function onkeydown(ev: KeyboardEvent) {
    // Ctrl + '0' ... '9' picks an item
    // TODO: extend it to `a` .. `z` ?
    handleListKeydown(
      ev,
      listboxRef,
      filter === "",
      (ev) => ev.ctrlKey && handleDigitPick(ev, len(itemsFiltered), (idx) => onselect(itemsFiltered[idx]!.item)),
    );
  }

  let listboxRef: ListBox;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  class="dlg z-20 absolute center-x-with-translate top-8 max-h-[94vh] flex flex-col p-2 max-w-[80vw] w-[40em]"
>
  <div>
    <input use:focus type="text" bind:value={filter} class="py-1 px-2 bg-white w-full min-w-100 mb-2 rounded-xs" />

    <div class="absolute right-4 top-3 italic text-gray-400">
      {countMsg}
    </div>
  </div>
  <ListBox bind:this={listboxRef} items={itemsFiltered} onclick={(item, metaPressed) => onselect(item.item)} {initialSelection}>
    {#snippet renderItem(item, idx)}
      {@const hili = hilightText(item.item.text, hiliRegExp)}
      <div class="truncate" style:padding-left={item.item.indent ? `${item.item.indent * 1.25}em` : undefined}>
        {@html hili}
      </div>
      <div class="grow"></div>
      {#if idx < 10}
        {@const s = `Ctrl + ${idx}`}
        <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">{s}</div>
      {/if}
    {/snippet}
  </ListBox>
</form>
