<script module lang="ts">
  export interface Command {
    label: string;
    run: () => unknown;
    status?: "disabled" | "hidden";
    paletteLabel?: string | false;
  }

  type MenuEntry = Command | { label: string; items?: MenuDef } | { separator: true };
  export type MenuDef = MenuEntry[];

  class MenuItem {
    text = "";
    shortcut = "";
    children?: MenuItem[];
    run?: Command["run"];
    element?: HTMLElement = $state();
    submenuElement?: HTMLElement;
    parent?: MenuItem;
    zIndex = 30;

    isSeparator = false;
    isDisabled = false;
    isSubMenu = false;
    isSelected = $state(false);
  }

  function buildMenuFromDef(menuDef: MenuDef, nest: number): MenuItem[] {
    const items: MenuItem[] = [];
    for (const entry of menuDef) {
      if ("run" in entry && entry.status === "hidden") continue;
      const item = new MenuItem();
      items.push(item);
      if ("separator" in entry) {
        item.isSeparator = true;
        item.isDisabled = true;
        continue;
      }
      const { name, shortcut } = splitCommandLabel(entry.label);
      item.text = name.replace("&", "");
      item.shortcut = shortcut;
      if ("items" in entry && entry.items) {
        item.isSubMenu = true;
        item.zIndex += nest;
        item.children = buildMenuFromDef(entry.items, nest + 1);
        for (const child of item.children) child.parent = item;
      } else if ("run" in entry) {
        item.run = entry.run;
        item.isDisabled = entry.status === "disabled";
      } else {
        item.isDisabled = true;
      }
    }
    return items;
  }
</script>

<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import { onMount } from "svelte";
  import { ensurevisible, focus } from "../actions";
  import { splitCommandLabel } from "../keys";
  import { isKeyDown, isKeyEnter, isKeyUp, len } from "../util";

  interface Props {
    menuDef: MenuDef;
    pos: { x: number; y: number } | null;
    executeCommand: (run: Command["run"]) => void;
  }
  let { menuDef, pos, executeCommand }: Props = $props();

  let rootMenu = buildMenuFromDef(menuDef, 1);

  function forEachMenuItem(visit: (mi: MenuItem) => boolean) {
    let toVisit: MenuItem[][] = [rootMenu];
    while (len(toVisit) > 0) {
      let items = toVisit.shift();
      if (!items) {
        continue;
      }
      for (let mi of items) {
        let cont = visit(mi);
        if (!cont) {
          return;
        }
        if (mi.isSubMenu && mi.children) {
          toVisit.push(mi.children);
        }
      }
    }
  }

  // first menu item (in any sub-menu) for which pred is true
  function findMenuItemWhere(pred: (mi: MenuItem) => boolean): MenuItem | undefined {
    let found: MenuItem | undefined;
    forEachMenuItem((mi) => {
      if (pred(mi)) {
        found = mi;
        return false;
      }
      return true;
    });
    return found;
  }

  function findMenuItemForElement(el: HTMLElement): MenuItem | undefined {
    return findMenuItemWhere((mi) => mi.element === el);
  }

  const kMenuShowDelay = 300;

  let showSubMenuTimer: number;

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

  function selectMenuItem(mi: MenuItem) {
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
    showSubMenuTimer = window.setTimeout(() => {
      updateVisiblityState();
    }, kMenuShowDelay);
  }

  function findMenuItem(ev: Event): MenuItem | undefined {
    let el: HTMLElement | null = ev.target as HTMLElement;
    while (el && el.role != "menuitem") {
      el = el.parentElement;
    }
    if (!el) {
      // console.log("no element with 'menuitem' role");
      return;
    }
    return findMenuItemForElement(el);
  }

  function handleMouseOver(ev: MouseEvent) {
    let mi = findMenuItem(ev);
    if (!mi) {
      return;
    }
    selectMenuItem(mi);
  }

  function handleClicked(ev: MouseEvent) {
    let mi = findMenuItem(ev);
    if (!mi?.run || mi.isDisabled) {
      return;
    }
    executeCommand(mi.run);
    ev.stopPropagation();
  }

  function findCurrentlySelected(): MenuItem | undefined {
    // find the most nested selected
    let found: MenuItem | undefined;
    let foundNest: number;
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

  function findSibling(mi: MenuItem, dir: number): MenuItem | undefined {
    let items: MenuItem[] = rootMenu;
    if (mi.parent && mi.parent.children) {
      items = mi.parent.children;
    }
    let idx = items.indexOf(mi);
    if (idx < 0) {
      return;
    }
    while (true) {
      idx += dir;
      if (idx < 0 || idx >= len(items)) {
        return;
      }
      mi = items[idx] as MenuItem;
      if (isSelectable(mi)) {
        return mi;
      }
    }
  }

  function isSelectable(mi: MenuItem): boolean {
    if (mi.isDisabled || mi.isSeparator) {
      return false;
    }
    return true;
  }

  function selectFirst(items: MenuItem[]) {
    // console.log("selectFirst");
    for (let mi of items) {
      if (!isSelectable(mi)) {
        continue;
      }
      selectMenuItem(mi);
      return;
    }
  }

  function selectSibling(dir: number) {
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
    if (!mi || !mi.isSubMenu || !mi.children) {
      return;
    }
    selectFirst(mi.children);
  }

  function handleKeydown(ev: KeyboardEvent) {
    let key = ev.key;
    // console.log("key:", key);
    if (isKeyEnter(ev)) {
      let found = findMenuItemWhere((mi) => mi.isSelected && !mi.isSubMenu);
      if (found?.run) {
        ev.preventDefault();
        ev.stopPropagation();
        executeCommand(found.run);
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

    if (isKeyUp(ev)) {
      selectSibling(-1);
      return;
    }
    if (isKeyDown(ev)) {
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

  let menuRef: HTMLElement;
  onMount(() => {
    if (pos) {
      // <d via mouse click
      ensurevisible(menuRef);
    }
  });
</script>

{#snippet separator(mi: MenuItem)}
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
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
{/snippet}

{#snippet menuItem(mi: MenuItem)}
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
      {#if mi.shortcut}
        <div class="kbd ml-4">{mi.shortcut}</div>
      {:else}
        <div></div>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet submenu(mi: MenuItem)}
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <div role="menuitem" tabindex="-1" class="relative my-1" class:is-selected={mi.isSelected} bind:this={mi.element}>
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
      {@render menuItems(mi.children as MenuItem[])}
    </div>
  </div>
{/snippet}

{#snippet menuItems(items: MenuItem[])}
  {#each items as mi}
    {#if mi.isSubMenu}
      {@render submenu(mi)}
    {:else}
      {@render menuItem(mi)}
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

<style lang="postcss">
  @reference "tailwindcss";

  .is-selected {
    @apply bg-gray-100 dark:bg-gray-600;
  }

  .sub-menu-wrapper {
    left: calc(80% - 8px);
  }
</style>
