<script module>
  /** @typedef {{
   block: any,
   text: string,
   key: number,
  }} Item
  */
</script>

<script>
  import { EditorView } from "@codemirror/view";
  import { focus, tooltip } from "../actions";
  import { toggleBlockFoldN } from "../editor/fold-gutter";
  import {
    findMatchingItems,
    getKeyEventNumber,
    hilightText,
    len,
    makeHilightRegExp,
  } from "../util";
  import { IconTablerFold } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  /** @type {{
    view: EditorView,
    blocks: Item[],
    selectBlock: (block : Item) => void,
    initialSelection?: number,
  }}*/
  let { view, blocks, selectBlock, initialSelection = 0 } = $props();

  /** @type {string} */
  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));

  let blockCountMsg = $state(`${len(blocks)} blocks`);
  if (len(blocks) == 1) {
    blockCountMsg = `1 block`;
  }

  /** @typedef {{item: Item, textLC: string, key: number }} BlockItem */

  /**
   * @returns {BlockItem[]}
   */
  function buildItems() {
    /** @type {BlockItem[]} */
    let res = [];
    for (let block of blocks) {
      let bi = {
        item: block,
        textLC: block.text.toLowerCase(),
        key: block.key,
      };
      res.push(bi);
    }
    return res;
  }

  /** @type {BlockItem[]} */
  let items = buildItems();

  /** @type {BlockItem[]} */
  let itemsFiltered = $derived(findMatchingItems(items, filter, "textLC"));

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    // Ctrl + '0' ... '9' picks an item
    // TODO: extend it to `a` .. `z` ?
    if (ev.ctrlKey) {
      let idx = getKeyEventNumber(ev);
      let lastIdx = len(blocks) - 1;
      if (idx >= 0 && idx <= lastIdx) {
        ev.preventDefault();
        let item = blocks[idx];
        selectBlock(item);
        return;
      }
    }

    listboxRef.onkeydown(ev, filter === "");
  }

  /** @type {ListBox} */
  let listboxRef;

  /**
   * @param {number} idx
   */
  function toggleFold(idx) {
    console.log("toggleFold:", idx);
    toggleBlockFoldN(view, idx);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  class="selector z-20 absolute center-x-with-translate top-[2rem] max-h-[94vh] flex flex-col p-2 max-w-[80vw] w-[40em]"
>
  <div>
    <input
      use:focus
      type="text"
      bind:value={filter}
      class="py-1 px-2 bg-white w-full min-w-[400px] mb-2 rounded-xs"
    />

    <div class="absolute right-[1rem] top-[0.75rem] italic text-gray-400">
      {blockCountMsg}
    </div>
  </div>
  <ListBox
    bind:this={listboxRef}
    items={itemsFiltered}
    onclick={(item) => selectBlock(item.item)}
    {initialSelection}
  >
    {#snippet renderItem(item, idx)}
      {@const hili = hilightText(item.item.text, hiliRegExp)}
      <div class="truncate">
        {@html hili}
      </div>
      <div class="grow"></div>
      {#if idx < 10}
        {@const s = `Ctrl + ${idx}`}
        <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">{s}</div>
      {/if}
      <button
        {@attach tooltip}
        onclick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleFold(idx);
        }}
        data-tooltip="toggle block fold"
        class="clickable-icon">{@render IconTablerFold()}</button
      >
    {/snippet}
  </ListBox>
</form>

<style>
  @reference "../main.css";

  .clickable-icon {
    @apply cursor-pointer px-1 py-1;

    &:hover {
      @apply bg-gray-200 dark:bg-gray-500;
    }
  }
</style>
