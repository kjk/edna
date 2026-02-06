<script lang="ts">
  import { focus } from "../actions";
  import type { BoopFunction } from "../functions";
  import { getFunctionMeta, toggleFunctionStarred } from "../metadata";
  import { getBoopFunctions } from "../system-notes";
  import { findMatchingItems, getAltChar, hilightText, len, makeHilightRegExp } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  interface Props {
    userFunctions: BoopFunction[];
    runFunction: (fn: BoopFunction, replace: boolean) => void;
    context: string;
  }
  let { userFunctions, runFunction, context }: Props = $props();

  interface Item {
    fdef: BoopFunction;
    key: number;
    name: string;
    nameLC: string;
    isStarred: boolean;
    ref: HTMLElement | null;
  }

  let altChar = getAltChar();

  function mkItem(fdef: BoopFunction, key: number): Item {
    let name = fdef.name;
    let nameLC = name.toLowerCase();
    let ref = null;
    let meta = getFunctionMeta(name);
    let isStarred = meta ? !!meta.isStarred : false;
    let res = {
      fdef,
      key,
      name,
      nameLC,
      isStarred,
      ref,
    };
    return res;
  }

  /**
   * -1 if a < b
   * 0 if a = b
   * 1 if a > b
   */
  function sortItem(a: Item, b: Item): number {
    // started before not starred
    if (a.isStarred && !b.isStarred) {
      return -1;
    }
    if (!a.isStarred && b.isStarred) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  }

  function buildItems(): Item[] {
    let blockFunctions = getBoopFunctions();
    let n = len(blockFunctions);
    let res = Array(n);
    let key = 0;
    for (let fdef of blockFunctions) {
      res[key++] = mkItem(fdef, key);
    }
    for (let fdef of userFunctions) {
      res[key++] = mkItem(fdef, key);
    }
    res.sort(sortItem);
    return res;
  }

  let items = $state(buildItems());
  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));

  let itemsFiltered: Item[] = $derived(findMatchingItems(items, filter, "nameLC"));

  let selectedItem: Item | null = $state(null);

  function emitRunFunction(item: Item, replace: boolean) {
    console.log("emitRunFunction:", item);
    runFunction(item.fdef, replace);
  }

  function onKeydown(ev: KeyboardEvent) {
    // console.log("onKeyDown:", event);
    let key = ev.key;

    if (key === "s" && ev.altKey && selectedItem) {
      toggleStarred(selectedItem);
      ev.preventDefault();
      return;
    }

    if (key === "Enter") {
      ev.preventDefault();
      if (selectedItem) {
        let replace = ev.ctrlKey;
        emitRunFunction(selectedItem, replace);
      }
      return;
    }
    listboxRef?.onkeydown(ev, filter === "");
  }

  let itemsCountMsg = $derived.by(() => {
    let n = len(itemsFiltered);
    let nItems = len(items);
    if (n === nItems) {
      return `${nItems} funcs`;
    }
    return `${n} of ${nItems} funcs`;
  });

  async function toggleStarred(item: Item) {
    item.isStarred = await toggleFunctionStarred(item.name);
    console.log("toggleStarred:", item, "isStarred:", item.isStarred);
    inputRef.focus();
  }

  let listboxRef: ListBox;
  let inputRef: HTMLInputElement;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="dlg absolute flex flex-col z-20 center-x-with-translate top-8 max-h-[90vh] w-[32em] p-2"
>
  <div>
    <div class="flex">
      <div class="text-center mb-2 font-semibold grow">
        run function with {context}
      </div>
      <a href="https://edna.arslexis.io/help#running-code" target="_blank" class="link ml-2">help</a>
    </div>
    <div>
      <input
        type="text"
        use:focus
        bind:this={inputRef}
        bind:value={filter}
        class="py-1 px-2 bg-white w-full mb-2 rounded-xs relative"
      />
      <div class="absolute right-4 top-[2.6rem] italic text-gray-400">
        {itemsCountMsg}
      </div>
    </div>
  </div>
  <ListBox
    bind:this={listboxRef}
    bind:selectedItem
    items={itemsFiltered}
    onclick={(item) => emitRunFunction(item, false)}
  >
    {#snippet renderItem(item)}
      {@const hili = hilightText(item.name, hiliRegExp)}
      <button
        class="-ml-1.5 cursor-pointer hover:text-yellow-600"
        onclick={(ev) => {
          toggleStarred(item);
          ev.preventDefault();
          ev.stopPropagation();
        }}
      >
        {@render IconTablerStar(item.isStarred ? "var(--color-yellow-300)" : "none")}
      </button>
      <div class="truncate ml-2">
        {@html hili}
      </div>
    {/snippet}
  </ListBox>
  {#if selectedItem}
    <div class="px-2 py-1 mt-2 text-sm text-gray-800 bg-yellow-100">
      {selectedItem.fdef.description}
    </div>
    <div class="dlg-info">
      <div class="kbd">Enter</div>
      <div>Run function, output in new block</div>
      <div class="kbd">Ctrl + Enter</div>
      <div>Run function, output replaces block content</div>
      <div class="kbd">{altChar} + S</div>
      <div>toggle favorite</div>
    </div>
  {/if}
</form>
