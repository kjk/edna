<script lang="ts">
  import type { Snippet } from "svelte";
  import { len } from "../util";
  import "overlayscrollbars/overlayscrollbars.css";
  import { onMount } from "svelte";
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
      // console.log("expanding refs to:", n);
      refs.length = n;
    }

    // TODO: this check shouldn't be necessary but
    // this effect gets re-run after changing selection
    if (n === prevItemsLen) {
      return;
    }
    // console.log(`re-runinng effect: ${len(items)} items`);
    prevItemsLen = n;
    // reset selection if changing items
    if (n > 0) {
      select(0);
      selectedItem = items[0];
    } else {
      select(-1);
      selectedItem = null;
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

  let listboxRef: HTMLElement;
  $effect(() => {
    let opts = getOverlayScrollbarOptions();
    OverlayScrollbars(listboxRef, opts);
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
      class="flex items-center px-2 leading-5 aria-selected:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 dark:aria-selected:text-opacity-85 dark:aria-selected:bg-gray-700 {compact
        ? ''
        : 'py-0.5'}"
      bind:this={refs[idx]}
    >
      {@render renderItem(item, idx)}
    </li>
  {/each}
</ul>

<style lang="postcss">
  :global(.os-scrollbar) {
    --os-size: 10px;
  }
</style>
