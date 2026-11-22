<script lang="ts">
  import type { Snippet } from "svelte";
  import { len } from "../util";
  import "overlayscrollbars/overlayscrollbars.css";
  import { onMount, untrack } from "svelte";
  import { OverlayScrollbars } from "overlayscrollbars";
  import { getOverlayScrollbarOptions } from "../settings.svelte";

  interface Props {
    items: any[];
    itemKey?: (item: any) => any;
    onclick: (item: any, metaPressed: boolean) => void;
    renderItem: Snippet<[any, number]>;
    selectionChanged?: (item: any, idx: number) => void;
    initialSelection?: number;
    selectedItem?: any;
    compact?: boolean;
    // "list": one item per line, "inline": items wrapped in lines, separated by bullets
    layout?: "list" | "inline";
  }
  let {
    items,
    itemKey = (item) => item.key,
    onclick,
    renderItem,
    selectionChanged = (el, idx) => {
      /* no op */
    },
    selectedItem = $bindable(null),
    initialSelection = 0,
    compact = false,
    layout = "list",
  }: Props = $props();

  let selectedIdx = $state(-1);

  let n = 0;
  let refs = $state(new Array(n));
  let prevItems: any[] | undefined;
  let prevItemsLen = 0;

  onMount(() => {
    n = len(items);
    let timerId = setTimeout(() => {
      if (initialSelection > n - 1) {
        initialSelection = n - 1;
      }
      if (n === 0) {
        initialSelection = -1;
      }
      select(initialSelection);
    }, 50);
    return () => {
      clearTimeout(timerId);
    };
  });

  // reset selection when items change (e.g. filtering or re-sorting).
  // checking only the count would leave selectedItem pointing to a different
  // item than the highlighted row when the count doesn't change.
  // also check the count for arrays mutated in place (e.g. search results)
  $effect(() => {
    let curr = items;
    let n = len(curr);
    untrack(() => {
      if (n > len(refs)) {
        refs.length = n;
      }
      if (curr === prevItems && n === prevItemsLen) {
        return;
      }
      // items appended to the same array (e.g. search results arriving):
      // keep the selection
      let appended = curr === prevItems && n > prevItemsLen && selectedIdx >= 0;
      prevItems = curr;
      prevItemsLen = n;
      if (appended) {
        return;
      }
      select(n > 0 ? 0 : -1);
    });
  });

  export function select(n: number) {
    let nItems = len(items);
    // console.log("select:", n, "nItems:", nItems);
    if (nItems <= 0) {
      if (selectedIdx != -1) {
        selectedIdx = -1;
        selectedItem = null;
        selectionChanged(null, -1);
      }
      return;
    }
    selectedIdx = 0;
    if (n >= 0 && n < nItems) {
      selectedIdx = n;
    }
    // console.log("selectedIdx:", selectedIdx);
    let ref = refs[selectedIdx];
    if (ref) {
      ref.scrollIntoView({ block: "nearest" });
    }
    let item = items[selectedIdx];
    selectedItem = item;
    selectionChanged(item, selectedIdx);
  }

  export function selected() {
    return items[selectedIdx];
  }

  export function up() {
    let nItems = len(items);
    if (nItems <= 0 || selectedIdx <= 0) {
      return;
    }
    select(selectedIdx - 1);
  }

  export function down() {
    let nItems = len(items);
    // console.log("down: selectedIdx:", selectedIdx, "nItems:", nItems);
    let lastIdx = nItems - 1;
    if (nItems <= 0 || selectedIdx >= lastIdx) {
      return;
    }
    select(selectedIdx + 1);
  }

  export function onkeydown(ev: KeyboardEvent, allowLeftRight: boolean = false): boolean {
    let key = ev.key;
    let isUp = key === "ArrowUp" || (key === "ArrowLeft" && allowLeftRight);
    if (layout === "inline" && isUp && selectedIdx <= 0) {
      // don't block cursor going left if input box has cursor at the end
      // of text and we're at first item
      return false;
    }
    let isDown = key === "ArrowDown" || (key === "ArrowRight" && allowLeftRight);
    let isEnter = selectedItem && key === "Enter";
    let res = true;
    if (isEnter) {
      let metaPressed = ev.ctrlKey || ev.metaKey;
      onclick(selectedItem, metaPressed);
    } else if (isUp) {
      up();
    } else if (isDown) {
      down();
    } else {
      res = false;
    }
    if (res) {
      ev.preventDefault();
    }
    return res;
  }

  let listboxRef: HTMLElement = $state()!;
  $effect(() => {
    let opts = getOverlayScrollbarOptions();
    let osInstance = OverlayScrollbars(listboxRef, opts);
    return () => {
      osInstance.destroy();
    };
  });

  function findItemIdxForMouseEvent(ev: MouseEvent): number {
    // note: could also traverse from ev.target via parentElement
    // until finds tagName === "LI", but this seems more reliable
    // slower but only executed on click
    // could also put a data-index attribute on li and use that to
    // index into items
    let n = len(items);
    for (let i = 0; i < n; i++) {
      let el = refs[i];
      if (el && el.contains(ev.target)) {
        return i;
      }
    }
    return -1;
  }

  function click(ev: MouseEvent) {
    let idx = findItemIdxForMouseEvent(ev);
    if (idx < 0) {
      return;
    }
    let item = items[idx];
    let metaPressed = ev.ctrlKey || ev.metaKey;
    ev.preventDefault();
    ev.stopPropagation();
    onclick(item, metaPressed);
    // console.log("didn't find item for ev.target:", ev.target);
  }

  function mousemove(ev: MouseEvent) {
    let idx = findItemIdxForMouseEvent(ev);
    if (idx < 0) {
      return;
    }
    if (idx === selectedIdx) {
      return;
    }
    select(idx);
  }
</script>

{#if layout === "inline"}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="overflow-y-auto cursor-pointer select-none flex flex-wrap gap-y-0.5 pb-4"
    tabindex="-1"
    role="listbox"
    bind:this={listboxRef}
    data-overlayscrollbars-initialize
    onclick={click}
    onmousemove={mousemove}
  >
    {#each items as item, idx (itemKey(item))}
      {#if idx > 0}
        <span class="text-gray-300">&bull;</span>
      {/if}
      <span
        role="option"
        aria-selected={idx === selectedIdx}
        class="px-1 aria-selected:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 dark:aria-selected:text-white/85 dark:aria-selected:bg-gray-700"
        bind:this={refs[idx]}
      >
        {@render renderItem(item, idx)}
      </span>
    {/each}
  </div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <ul
    class="overflow-y-auto cursor-pointer select-none"
    role="listbox"
    bind:this={listboxRef}
    data-overlayscrollbars-initialize
    onclick={click}
    onmousemove={mousemove}
  >
    {#each items as item, idx (itemKey(item))}
      <li
        role="option"
        aria-selected={idx === selectedIdx}
        class="flex items-center px-2 leading-5 aria-selected:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 dark:aria-selected:text-white/85 dark:aria-selected:bg-gray-700 {compact
          ? ''
          : 'py-0.5'}"
        bind:this={refs[idx]}
      >
        {@render renderItem(item, idx)}
      </li>
    {/each}
  </ul>
{/if}

<style lang="postcss">
  :global(.os-scrollbar) {
    --os-size: 10px;
  }
</style>
