<script module>
  /** @typedef {{
   block: any,
   text: string,
   key: number,
  }} Item
  */
</script>

<script>
  import { focus } from "../actions";
  import { findMatchingItems, getKeyEventNumber, len } from "../util";
  import ListBox from "./ListBox.svelte";

  /** @type {{
   blocks: Item[],
   selectBlock: (block : Item) => void,
   initialSelection?: number,
  }}*/
  let { blocks, selectBlock, initialSelection = 0 } = $props();

  /** @type {string} */
  let filter = $state("");

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

  let listboxRef;
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
      <div class="truncate">
        {item.item.text}
      </div>
      <div class="grow"></div>
      {#if idx < 10}
        {@const s = `Ctrl + ${idx}`}
        <div class="ml-4 mr-2 text-xs text-gray-400 whitespace-nowrap">{s}</div>
      {/if}
    {/snippet}
  </ListBox>
</form>
