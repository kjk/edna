<script module>
  /** @typedef {[string, number|MenuItemDef[]]} MenuItemDef */
  /** @typedef {MenuItemDef[]} MenuDef */

  // when used as menu id this will show as a text, not a menu item
  export const kMenuIdJustText = -1;

  export const kMenuStatusNormal = 0;
  export const kMenuStatusDisabled = 1;
  export const kMenuStatusRemoved = 2;

  export const kMenuSeparator = ["---", 0];

  /**
   * @param {string} s
   * @returns {string}
   */
  export function fixMenuName(s) {
    if (!s) {
      if (s === "") {
        return "";
      }
    }
    s = s.replace("&", "");
    // remove keyboard shortcut
    let parts = s.split("\t");
    return parts[0];
  }

  /**
   * @param {MenuItemDef} mi
   * @returns {string}
   */
  function getShortcut(mi) {
    let s = mi[0];
    let parts = splitMax(s, "\t", 2);
    if (len(parts) > 1) {
      return extractShortcut(parts[1]);
    }
    return "";
  }

  class MenuItem {
    text = "";
    shortcut = "";
    /** @type {MenuItem[]} */
    children = null;
    cmdId = 0;
    /** @type {HTMLElement} */
    element = $state(null);
    /** @type {HTMLElement} */
    submenuElement = null;
    /** @type {MenuItem} */
    parent = null;
    zIndex = 30;

    isSeparator = false;
    isRemoved = false;
    isDisabled = false;
    isSubMenu = false;
    isSelected = $state(false);
  }

  /**
   * @param {MenuDef} menuDef
   * @param {(mi: MenuItemDef) => number} menuItemStatus
   * @returns {MenuItem[]}
   */
  function buildMenuFromDef(menuDef, nest, menuItemStatus) {
    /*** @type {MenuItem[]} */
    let res = [];
    for (let mi of menuDef) {
      let i = new MenuItem();
      res.push(i);
      i.text = fixMenuName(mi[0]);
      i.shortcut = getShortcut(mi);
      const miStatus = menuItemStatus(mi);
      i.isDisabled = miStatus === kMenuStatusDisabled;
      i.isRemoved = miStatus === kMenuStatusRemoved;
      i.isSeparator = mi[0] === kMenuSeparator[0];
      if (i.isSeparator) {
        i.isDisabled = true;
      }
      let idOrSubMenu = mi[1];
      if (Array.isArray(idOrSubMenu)) {
        i.isSubMenu = true;
        i.zIndex += nest;
        i.children = buildMenuFromDef(idOrSubMenu, nest + 1, menuItemStatus);
        for (let c of i.children) {
          c.parent = i;
        }
      } else {
        i.cmdId = idOrSubMenu;
      }
    }
    return res;
  }
</script>

<script>
  import { onMount } from "svelte";
  import { ensurevisible, focus } from "./actions.js";
  import { extractShortcut } from "./keys.js";
  import { len, splitMax } from "./util.js";

  /** @type {{
   menuDef: MenuDef,
   pos: {x: number, y: number},
   menuItemStatus?: (mi: MenuItemDef) => number,
   onmenucmd: (cmd: number) => void,
}}*/
  let { menuDef: menuDef, pos, menuItemStatus = null, onmenucmd } = $props();

  /**
   * @param {MenuItemDef} mid
   */
  function menuItemStatusDefault(mid) {
    return kMenuStatusNormal;
  }

  let rootMenu = buildMenuFromDef(
    menuDef,
    1,
    menuItemStatus || menuItemStatusDefault,
  );

  /**
   * @param {(mi: MenuItem) => boolean} visit
   */
  function forEachMenuItem(visit) {
    /** @type {MenuItem[][]} */
    let toVisit = [rootMenu];
    while (len(toVisit) > 0) {
      let items = toVisit.shift();
      for (let mi of items) {
        let cont = visit(mi);
        if (!cont) {
          return;
        }
        if (mi.isSubMenu) {
          toVisit.push(mi.children);
        }
      }
    }
  }

  /**
   * @param {HTMLElement} el
   * @returns {MenuItem}
   */
  function findMenuItemForElement(el) {
    let found = null;
    function visit(mi) {
      if (mi.element === el) {
        found = mi;
        return false;
      }
      return true;
    }
    forEachMenuItem(visit);
    return found;
  }

  const kMenuShowDelay = 300;

  let showSubMenuTimer;

  function updateVisiblityState() {
    forEachMenuItem((mi) => {
      if (mi.submenuElement) {
        let display = mi.isSelected ? "block" : "none";
        mi.submenuElement.style.display = display;
        if (mi.isSelected) {
          ensurevisible(mi.submenuElement, true);
        }
      }
      return true;
    });
  }

  /**
   * @param {MenuItem} mi
   */
  function selectMenuItem(mi) {
    // console.log("selectMenuItem:", mi.text, "isSelected:", mi.isSelected);
    if (mi.isSelected) {
      return;
    }
    forEachMenuItem((mi) => {
      mi.isSelected = false;
      return true;
    });
    if (!mi.isDisabled) {
      mi.isSelected = true;
    }
    // also preserve selection state of the parent(s)
    while (mi.parent) {
      mi = mi.parent;
      mi.isSelected = true;
    }
    showSubMenuTimer = setTimeout(() => {
      updateVisiblityState();
    }, kMenuShowDelay);
  }

  /**
   * @param {Event} ev
   * @returns {MenuItem}
   */
  function findMenuItem(ev) {
    let el = /** @type {HTMLElement} */ (ev.target);
    while (el && el.role != "menuitem") {
      el = el.parentElement;
    }
    if (!el) {
      // console.log("no element with 'menuitem' role");
      return null;
    }
    return findMenuItemForElement(el);
  }

  /**
   * @param {MouseEvent} ev
   */
  function handleMouseOver(ev) {
    let mi = findMenuItem(ev);
    if (!mi) {
      return;
    }
    selectMenuItem(mi);
  }

  /**
   * @param {MouseEvent} ev
   */
  function handleClicked(ev) {
    let mi = findMenuItem(ev);
    if (!mi || mi.cmdId <= 0) {
      return;
    }
    onmenucmd(mi.cmdId);
    ev.stopPropagation();
  }

  /**
   * @returns {MenuItem}
   */
  function findCurrentlySelected() {
    // find the most nested selected
    /** @type {MenuItem} */
    let found;
    let foundNest;
    forEachMenuItem((mi) => {
      if (!mi.isSelected || !isSelectable(mi)) {
        return true;
      }
      let nest = 1;
      let tmp = mi;
      while (tmp.parent) {
        nest++;
        tmp = tmp.parent;
      }
      if (!found || nest > foundNest) {
        found = mi;
        foundNest = nest;
      }
      return true;
    });
    // console.log("currentlySelected:", found.text);
    return found;
  }

  /**
    @param {MenuItem} mi
    @param {number} dir
    @returns {MenuItem}
   */
  function findSibling(mi, dir) {
    let items = rootMenu;
    if (mi.parent) {
      items = mi.parent.children;
    }
    let idx = items.indexOf(mi);
    if (idx < 0) {
      return null;
    }
    while (true) {
      idx += dir;
      if (idx < 0 || idx >= len(items)) {
        return null;
      }
      mi = items[idx];
      if (!mi.isDisabled && !mi.isRemoved) {
        return mi;
      }
    }
  }

  function isSelectable(mi) {
    if (mi.isRemoved || mi.isDisabled || mi.isSeparator) {
      return false;
    }
    return true;
  }

  /**
   * @param {MenuItem[]} items
   */
  function selectFirst(items) {
    // console.log("selectFirst");
    for (let mi of items) {
      if (!isSelectable(mi)) {
        continue;
      }
      selectMenuItem(mi);
      return;
    }
  }

  function selectSibling(dir) {
    let mi = findCurrentlySelected();
    if (!mi) {
      selectFirst(rootMenu);
      return;
    }
    mi = findSibling(mi, dir);
    if (mi) {
      selectMenuItem(mi);
    }
  }

  function selectParent() {
    let mi = findCurrentlySelected();
    if (!mi || !mi.parent) {
      return;
    }
    mi.isSelected = false;
    selectMenuItem(mi.parent);
  }

  function selectChild() {
    let mi = findCurrentlySelected();
    if (!mi || !mi.isSubMenu) {
      return;
    }
    selectFirst(mi.children);
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function handleKeydown(ev) {
    let key = ev.key;
    // console.log("key:", key);
    if (key === "Enter") {
      /** @type {MenuItem} */
      let found = null;
      forEachMenuItem((mi) => {
        if (mi.isSelected && !mi.isSubMenu) {
          found = mi;
          return false;
        }
        return true;
      });
      if (found) {
        ev.preventDefault();
        ev.stopPropagation();
        onmenucmd(found.cmdId);
      }
      return;
    }

    if (key === "Tab") {
      let dir = 1;
      if (ev.shiftKey) {
        dir = -1;
      }
      selectSibling(dir);
      ev.preventDefault();
      return;
    }

    if (key === "ArrowUp") {
      selectSibling(-1);
      return;
    }
    if (key === "ArrowDown") {
      selectSibling(1);
      return;
    }
    if (key === "ArrowLeft") {
      selectParent();
      return;
    }
    if (key === "ArrowRight") {
      selectChild();
    }
  }

  function initialPositionStyle() {
    let st = "";
    // hack: when used as a drop-down of relative element
    // we position it just right relative to the icon
    if (!pos) {
      st = `left: -12px; top: 14px`;
    } else {
      // otherwise it's a mouse click so initial position where mouse is
      st = `left: ${pos.x}px; top: ${pos.y}px`;
    }
    // console.log("initialStyle:", st, "pos:", pos);
    return st;
  }

  // TODO: don't understand why this fires frequently
  let didSelectFirst = false;
  $effect(() => {
    if (didSelectFirst) {
      return;
    }
    didSelectFirst = true;
    selectFirst(rootMenu);
  });

  /** @type {HTMLElement} */
  let menuRef;
  onMount(() => {
    if (pos) {
      // invoked via mouse click
      ensurevisible(menuRef);
    }
  });
</script>

{#snippet separator(mi)}
  <div class="border-y border-gray-200 mt-1 mb-1"></div>
{/snippet}

{#snippet arrow()}
  <svg
    class="h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="2"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M8.25 4.5l7.5 7.5-7.5 7.5"
    />
  </svg>
{/snippet}

{#snippet checkmark()}
  <svg
    class="w-4 h-4 check invisible"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    ><path
      fill="currentColor"
      d="m10 16.4l-4-4L7.4 11l2.6 2.6L16.6 7L18 8.4Z"
    />
  </svg>
{/snippet}

{#snippet menuItem(mi)}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  {#if mi.isSeparator}
    {@render separator(mi)}
  {:else}
    <div
      role="menuitem"
      tabindex={mi.isDisabled ? undefined : 0}
      class="min-w-[12em] flex items-center justify-between px-3 py-1 whitespace-nowrap aria-disabled:text-gray-400"
      class:is-selected={mi.isSelected}
      aria-disabled={mi.isDisabled}
      bind:this={mi.element}
    >
      <div>{mi.text}</div>
      <div class="ml-4 text-xs opacity-75">{mi.shortcut || ""}</div>
    </div>
  {/if}
{/snippet}

{#snippet submenu(mi)}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <div
    role="menuitem"
    tabindex="-1"
    class="relative my-1"
    class:is-selected={mi.isSelected}
    bind:this={mi.element}
  >
    <button class="flex w-full items-center justify-between pl-3 pr-2 py-0.5">
      <span>{mi.text}</span>
      {@render arrow()}
    </button>
    <div
      role="menu"
      bind:this={mi.submenuElement}
      style:z-index={mi.zIndex}
      class="sub-menu-wrapper absolute top-0 hidden rounded-md border bg-white dark:bg-gray-700 border-neutral-50 py-1 shadow-lg"
    >
      {@render menuItems(mi.children)}
    </div>
  </div>
{/snippet}

{#snippet menuItems(items)}
  {#each items as mi}
    {#if !mi.isRemoved}
      {#if mi.isSubMenu}
        {@render submenu(mi)}
      {:else}
        {@render menuItem(mi)}
      {/if}
    {/if}
  {/each}
{/snippet}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
  role="menu"
  tabindex="-1"
  use:focus
  bind:this={menuRef}
  class="absolute z-20 mt-1 rounded-md border border-neutral-50 bg-white dark:bg-gray-700 dark:text-gray-300 py-1 shadow-lg focus:outline-hidden cursor-pointer select-none"
  style={initialPositionStyle()}
  onclick={handleClicked}
  onmouseover={handleMouseOver}
  onkeydown={handleKeydown}
>
  {@render menuItems(rootMenu)}
</div>

<style>
  @reference "./main.css";

  .is-selected {
    @apply bg-gray-100 dark:bg-gray-600;
  }

  .sub-menu-wrapper {
    left: calc(80% - 8px);
  }
</style>
