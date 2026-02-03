<script lang="ts">
  import type { Snippet } from "svelte";
  import { len } from "../util";
  import "overlayscrollbars/overlayscrollbars.css";
  import { onMount } from "svelte";
  import { OverlayScrollbars } from "overlayscrollbars";
  import { getOverlayScrollbarOptions } from "../settings.svelte";

  interface Props {
    items: any[];
    onclick: (n: number) => void;
    renderItem: Snippet<[any, number]>;
    selectionChanged?: (item: any, idx: number) => void;
    initialSelection?: number;
    selectedItem?: any;
  }
  let {
    items,
    onclick,
    renderItem,
    selectedItem = $bindable(null),
    selectionChanged = (el, idx) => {
      /* no op */
    },
    initialSelection = 0,
  }: Props = $props();

  let selectedIdx = $state(-1);

  let n = 0;
  let refs = $state(new Array(n));
  let prevItemsLen = n;

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

  $effect(() => {
    let n = len(items);
    if (n > len(refs)) {
      console.log("expanding refs to:", n);
      refs.length = n;
    }

    // TODO: this check shouldn't be necessary but
    // this effect gets re-run after changing selection
    if (n === prevItemsLen) {
      return;
    }
    // console.log("re-runinng effect:", len(items));
    prevItemsLen = n;
    // reset selection if changing items
    if (n > 0) {
      select(0);
    } else {
      select(-1);
    }
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
    ref.scrollIntoView({ block: "nearest" });
    let item = items[selectedIdx];
    selectedItem = item;
    selectionChanged(item, selectedIdx);
  }

  export function onkeydown(ev: KeyboardEvent, allowLeftRight: boolean = false): boolean {
    let key = ev.key;
    let isUp = key === "ArrowUp" || (key === "ArrowLeft" && allowLeftRight);
    if (isUp && selectedIdx <= 0) {
      // don't block cursor going left if input box has cursor at the end
      // of text and we're at first item
      return;
    }
    let isDown = key === "ArrowDown" || (key === "ArrowRight" && allowLeftRight);
    let isEnter = selectedItem && key === "Enter";
    let res = true;
    if (isEnter) {
      onclick(selectedItem);
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
    // console.log("donw: selectedIdx:", selectedIdx, "nItems:", nItems);
    let lastIdx = nItems - 1;
    if (nItems <= 0 || selectedIdx >= lastIdx) {
      return;
    }
    select(selectedIdx + 1);
  }

  let listboxRef;
  $effect(() => {
    $effect(() => {
      let opts = getOverlayScrollbarOptions();
      OverlayScrollbars(listboxRef, opts);
    });
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
      if (el.contains(ev.target)) {
        return i;
      }
    }
    return -1;
  }

  function listboxclick(ev: MouseEvent) {
    let idx = findItemIdxForMouseEvent(ev);
    if (idx < 0) {
      return;
    }
    let item = items[idx];
    onclick(item);
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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="overflow-y-auto cursor-pointer flex flex-wrap gap-y-[2px] pb-4"
  tabindex="-1"
  role="listbox"
  bind:this={listboxRef}
  data-overlayscrollbars-initialize
  onclick={listboxclick}
  onmousemove={mousemove}
>
  {#each items as item, idx (item.key)}
    {@const isSelected = idx === selectedIdx}
    {#if idx > 0}
      <span class="text-gray-300">&bull;</span>
    {/if}
    <span
      role="option"
      aria-selected={isSelected}
      class="item px-1 aria-selected:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 dark:aria-selected:text-opacity-85 dark:aria-selected:bg-gray-700 white"
      bind:this={refs[idx]}
    >
      {@render renderItem(item, idx)}
    </span>
  {/each}
</div>

<style lang="postcss">
  :global(.os-scrollbar) {
    --os-size: 10px;
  }

  /* note: those don't seem to have any effect */
  .item {
    /* flex: 0 1 auto; */
    /* word-break: break-word; */
    /* overflow-wrap: break-word; */
    /* white-space: normal; */
  }

  /* alternative: doesn't break on star icon but creates more whitespace */
  /* .item {
    flex: 1 1 auto;
    overflow-wrap: break-word;
    white-space: nowrap;
  } */
</style>
