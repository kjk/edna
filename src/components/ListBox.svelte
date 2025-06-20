<script>
  import { len } from "../util";
  import "overlayscrollbars/overlayscrollbars.css";
  import { OverlayScrollbars } from "overlayscrollbars";
  import { getOverlayScrollbarOptions } from "../settings.svelte";

  /** @type {{ 
    items: any[],
    onclick: (any) => void,
    renderItem: any,
    selectionChanged?: (any, number) => void,
    initialSelection?: number,
    selectedItem?: any,
    compact?: boolean,
  }}*/
  let {
    items,
    onclick,
    renderItem,
    selectionChanged = (el, idx) => {
      /* no op */
    },
    selectedItem = $bindable(null),
    initialSelection = 0,
    compact = false,
  } = $props();

  let selectedIdx = $state(-1);

  let n = len(items);
  let refs = $state(new Array(n));
  let prevItemsLen = n;

  // make sure to call selectionChanged() callback on initial
  // selection, so if there's state calcualted based on that,
  // it gets properly initalized
  setTimeout(() => {
    // console.log("initialSelection:", initialSelection, "n:", n);
    if (initialSelection > n - 1) {
      initialSelection = n - 1;
    }
    if (n === 0) {
      initialSelection = -1;
    }
    select(initialSelection);
  }, 50);

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

  /**
   * @param {number} n
   */
  export function select(n) {
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

  /**
   * @param {KeyboardEvent} ev
   * @param {boolean} [allowLeftRight]
   * @returns {boolean}
   */
  export function onkeydown(ev, allowLeftRight = false) {
    let key = ev.key;
    let isUp = key === "ArrowUp" || (key === "ArrowLeft" && allowLeftRight);
    let isDown =
      key === "ArrowDown" || (key === "ArrowRight" && allowLeftRight);
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

  let listbox;
  $effect(() => {
    let opts = getOverlayScrollbarOptions();
    OverlayScrollbars(listbox, opts);
  });

  /**
   * @param {MouseEvent} ev
   * @returns {number}
   */
  function findItemIdxForMouseEvent(ev) {
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

  /**
   * @param {MouseEvent} ev
   */
  function click(ev) {
    let idx = findItemIdxForMouseEvent(ev);
    if (idx < 0) {
      return;
    }
    let item = items[idx];
    onclick(item);
    // console.log("didn't find item for ev.target:", ev.target);
  }

  /**
   * @param {MouseEvent} ev
   */
  function mousemove(ev) {
    let idx = findItemIdxForMouseEvent(ev);
    if (idx < 0) {
      return;
    }
    select(idx);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<ul
  class="overflow-y-auto cursor-pointer select-none"
  role="listbox"
  bind:this={listbox}
  data-overlayscrollbars-initialize
  onclick={click}
  onmousemove={mousemove}
>
  {#each items as item, idx (item.key)}
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

<style>
  :global(.os-scrollbar) {
    --os-size: 10px;
  }
</style>
