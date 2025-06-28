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

  let listboxRef;
  $effect(() => {
    let opts = getOverlayScrollbarOptions();
    OverlayScrollbars(listboxRef, opts);
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
    console.log("click:", ev);
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

  let draggedItem = $state(null);
  let draggedOverItem = $state(null);

  function handleDragStart(e, item) {
    draggedItem = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.innerHTML);
    e.target.classList.add("dragging");
  }

  function handleDragEnd(e) {
    e.target.classList.remove("dragging");
    draggedItem = null;
    draggedOverItem = null;
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  function handleDragEnter(e, item) {
    if (draggedItem.key !== item.key) {
      draggedOverItem = item;
    }
  }

  function handleDragLeave(e) {
    if (e.target.classList.contains("list-item")) {
      e.target.classList.remove("drag-over");
    }
  }

  function handleDrop(e, targetItem) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    if (draggedItem !== targetItem) {
      const draggedIndex = items.findIndex(
        (item) => item.key === draggedItem.key,
      );
      const targetIndex = items.findIndex(
        (item) => item.key === targetItem.key,
      );

      // Remove dragged item
      const [removed] = items.splice(draggedIndex, 1);

      // Insert at new position
      items.splice(targetIndex, 0, removed);

      // Trigger reactivity
      items = items;
    }

    return false;
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
  {#each items as item, idx (item.key)}
    <li
      role="option"
      class:drag-over={draggedOverItem?.key === item.key &&
        draggedItem?.key !== item.key}
      draggable="true"
      ondragstart={(e) => handleDragStart(e, item)}
      ondragend={handleDragEnd}
      ondragover={handleDragOver}
      ondragenter={(e) => handleDragEnter(e, item)}
      ondragleave={handleDragLeave}
      ondrop={(e) => handleDrop(e, item)}
      aria-selected={idx === selectedIdx}
      class="l-item flex items-center px-2 leading-5 aria-selected:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 dark:aria-selected:text-opacity-85 dark:aria-selected:bg-gray-700 {compact
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

  .l-item {
    cursor: move;
  }

  .l-item.dragging {
    opacity: 0.5;
    background-color: #e3f2fd;
  }

  .l-item.drag-over {
    border: 2px dashed #2196f3;
    background-color: #e3f2fd;
  }
</style>
