<script>
  import { len } from "../util";
  import "overlayscrollbars/overlayscrollbars.css";
  import { OverlayScrollbars } from "overlayscrollbars";
  import { getActiveTheme } from "../settings";

  /** @type {{ 
    items: any[],
    onclick: (any) => void,
    renderItem: any,
    selectionChanged?: (any, number) => void,
    initialSelection?: number,
  }}*/
  let {
    items,
    onclick,
    renderItem,
    selectionChanged = (el, idx) => {
      /* no op */
    },
    initialSelection = 0,
  } = $props();

  let selectedIdx = $state(-1);

  let n = len(items);
  let refs = new Array(n);
  let prevItemsLen = n;

  // make sure to call selectionChanged() callback on initial
  // selection, so if there's state calcualted based on that,
  // it gets properly initalized
  setTimeout(() => {
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
    } else {
      select(-1);
    }
  });

  /**
   * @param {number} n
   */
  export function select(n) {
    let nItems = len(items);
    console.log("select:", n, "nItems:", nItems);
    if (nItems <= 0) {
      if (selectedIdx != -1) {
        selectedIdx = -1;
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

  let listbox;
  $effect(() => {
    let theme = getActiveTheme();
    // console.log("listbox overlay scrollbars, theme:", theme);
    let opts = {};
    if (theme === "dark") {
      opts = {
        scrollbars: {
          theme: "os-theme-dark",
        },
      };
    }
    OverlayScrollbars(listbox, opts);
  });

  /**
   * @param {MouseEvent} ev
   */
  function listboxclick(ev) {
    // note: could also traverse from ev.target via parentElement
    // until finds tagName === "LI", but this seems more reliable
    // slower but only executed on click
    // could also put a data-index attribute on li and use that to
    // index into items
    let n = len(items);
    for (let i = 0; i < n; i++) {
      let el = refs[i];
      if (el.contains(ev.target)) {
        let item = items[i];
        onclick(item);
        return;
      }
    }
    // console.log("didn't find item for ev.target:", ev.target);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<ul
  class="items overflow-y-auto"
  role="listbox"
  bind:this={listbox}
  data-overlayscrollbars-initialize
  onclick={listboxclick}
>
  {#each items as item, idx (item.key)}
    <li
      role="option"
      aria-selected={idx === selectedIdx}
      class="cursor-pointer py-0.5 px-2 leading-5 flex dark:text-opacity-50 hover:bg-gray-200 dark:hover:bg-gray-600 aria-selected:text-white aria-selected:bg-gray-400 dark:aria-selected:text-opacity-85 dark:aria-selected:bg-gray-700"
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
