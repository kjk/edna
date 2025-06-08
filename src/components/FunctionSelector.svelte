<script>
  import ListBox from "./ListBox.svelte";
  import { focus } from "../actions";
  import { findMatchingItems, getAltChar, len } from "../util";
  import { getBoopFunctions } from "../system-notes";
  import { getFunctionMeta, toggleFunctionStarred } from "../metadata";
  import IconStar from "./IconStar.svelte";

  /** @typedef {import("../functions").BoopFunction} BoopFunction */

  /** @type {{
   userFunctions: BoopFunction[],
   runFunction: (fn: BoopFunction, replace: boolean) => void,
   context: string
  }}*/

  let { userFunctions, runFunction, context } = $props();

  /** @typedef {{
    fdef: BoopFunction,
    key: number,
    name: string,
    nameLC: string,
    isStarred: boolean,
    ref: HTMLElement,
   }} Item
  */

  let altChar = getAltChar();

  /**
   * @param {BoopFunction} fdef
   * @param {number} key
   * @returns {Item}
   */
  function mkItem(fdef, key) {
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
   * @param {Item} a
   * @param {Item} b
   */
  function sortItem(a, b) {
    // started before not starred
    if (a.isStarred && !b.isStarred) {
      return -1;
    }
    if (!a.isStarred && b.isStarred) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  }

  /**
   * @returns {Item[]}
   */
  function buildItems() {
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

  /**
   * @returns {Item[]}
   */
  let itemsFiltered = $derived(findMatchingItems(items, filter, "nameLC"));

  /** @type {Item} */
  let selectedItem = $state(null);

  /**
   * @param {Item} item
   * @param {boolean} replace
   */
  function emitRunFunction(item, replace) {
    console.log("emitRunFunction:", item);
    runFunction(item.fdef, replace);
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onKeydown(ev) {
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
    listbox.onkeydown(ev, filter === "");
  }

  let itemsCountMsg = $derived.by(() => {
    let n = len(itemsFiltered);
    let nItems = len(items);
    if (n === nItems) {
      return `${nItems} funcs`;
    }
    return `${n} of ${nItems} funcs`;
  });

  /**
   * @param {Item} item
   */
  async function toggleStarred(item) {
    item.isStarred = await toggleFunctionStarred(item.name);
    console.log("toggleStarred:", item, "isStarred:", item.isStarred);
    input.focus();
  }

  let listbox;
  let input;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="selector absolute flex flex-col z-20 center-x-with-translate top-[2rem] max-h-[90vh] w-[32em] p-2"
>
  <div>
    <div class="flex">
      <div class="text-center mb-2 font-semibold grow">
        run function with {context}
      </div>
      <a
        href="https://edna.arslexis.io/help#running-code"
        target="_blank"
        class="underline underline-offset-2 ml-2">help</a
      >
    </div>
    <div>
      <input
        type="text"
        use:focus
        bind:this={input}
        bind:value={filter}
        class="py-1 px-2 bg-white w-full mb-2 rounded-xs relative"
      />
      <div class="absolute right-[1rem] top-[2.6rem] italic text-gray-400">
        {itemsCountMsg}
      </div>
    </div>
  </div>
  <ListBox
    bind:this={listbox}
    bind:selectedItem
    items={itemsFiltered}
    onclick={(item) => emitRunFunction(item, false)}
  >
    {#snippet renderItem(item)}
      <button
        class="ml-[-6px] cursor-pointer hover:text-yellow-600"
        onclick={(ev) => {
          toggleStarred(item);
          ev.preventDefault();
          ev.stopPropagation();
        }}
        ><IconStar fill={item.isStarred ? "var(--color-yellow-300)" : "none"}
        ></IconStar></button
      >
      <div class="truncate ml-2">
        {item.name}
      </div>
    {/snippet}
  </ListBox>
  {#if selectedItem}
    <div class="px-2 py-1 mt-2 text-sm text-gray-800 bg-yellow-100">
      {selectedItem.fdef.description}
    </div>
    <div class="selector-info">
      <div class="kbd">Enter</div>
      <div>Run function, output in new block</div>
      <div class="kbd">Ctrl + Enter</div>
      <div>Run function, output replaces block content</div>
      <div class="kbd">{altChar} + S</div>
      <div>toggle favorite</div>
    </div>
  {/if}
</form>
