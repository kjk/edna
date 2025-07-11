<script>
  import { appState } from "../appstate.svelte.js";
  import { focusEditor, openNoteSelector } from "../globals.js";
  import Menu from "../Menu.svelte";
  import { getNoteMeta } from "../metadata.js";
  import { isMoving } from "../mouse-track.svelte.js";
  import { isSystemNoteName } from "../notes.js";
  import { getSettings } from "../settings.svelte.js";
  import { getAltChar, len } from "../util.js";
  import HelpDropDown from "./HelpDropDown.svelte";
  import {
    IconMdiArrowCollapseLeft,
    IconMdiArrowCollapseRight,
    IconMenu,
    IconTablerPlus,
    IconTablerX,
  } from "./Icons.svelte";
  import QuickAccess from "./QuickAccess.svelte";

  /** @typedef {import("../Menu.svelte").MenuDef} MenuDef */
  /** @typedef {import("../Menu.svelte").MenuItemDef} MenuItemDef */

  /** @type {{ 
    class?: string,
    openNote: (name: string, newTab: boolean) => void,
    closeTab: (name: string) => void,

    buildMenuDef: any,
    menuItemStatus?: (mi: MenuItemDef) => number,
    onmenucmd: (cmd: number) => void,

  }} */
  let {
    class: klass = "",
    openNote,
    closeTab,
    buildMenuDef,
    menuItemStatus,
    onmenucmd,
  } = $props();

  let altChar = getAltChar();

  /**
   * @param {string} noteName
   * @returns {string}
   */
  function getNameWithShortcut(noteName) {
    let m = getNoteMeta(noteName);
    if (m && m.altShortcut) {
      return `${noteName}  (${altChar} + ${m.altShortcut})`;
    }
    return noteName;
  }

  /**
   * @param {string} noteName
   * @param {boolean} newTab
   */
  function myOpenNote(noteName, newTab) {
    showingQuickAccess = false;
    openNote(noteName, newTab);
  }

  let settings = getSettings();
  let showingQuickAccess = $state(false);
  let cls = $derived.by(() => {
    if (settings.alwaysShowTopNav) {
      return "bg-gray-200";
    }
    if (isMoving.moving) {
      return "visible fixed top-0 z-10 right-0";
    }
    return "invisible fixed top-0 z-10 right-0";
  });

  /** @type {HTMLElement} */
  let ednaRef = $state(null);

  const colors = [
    "red",
    "orange",
    "green",
    "blue",
    "indigo",
    "violet", // original rainbow colors
    "darkred",
    "darkorange",
    "gold",
    "forestgreen",
    "royalblue",
    "purple",
    "deeppink",
    "crimson",
    "teal",
    "navy",
    "darkgreen",
    "darkcyan",
    "mediumvioletred",
    "darkslateblue",
    "firebrick",
    "orchid",
    "mediumspringgreen",
    "darkmagenta",
    "darkolivegreen",
    "saddlebrown",
  ];
  let colorIndex = 0;
  let colorChangeInterval;
  let startColor;

  let showingHelp = $state(false);

  function openURLOrNote(url) {
    showingHelp = false;
    if (url.startsWith("system:")) {
      openNote(url, true);
      return;
    }
    if (!url.startsWith("http")) {
      url = window.location.origin + url;
    }
    window.open(url, "_blank");
  }

  let shwingMenu = $state(false);
  let noFocusEditorOnMenuOut = false;
  let menuPos = { x: 0, y: 0 };
  function myOnMenuCmd(cmdid) {
    noFocusEditorOnMenuOut = true;
    shwingMenu = false;
    onmenucmd(cmdid);
  }

  function noteCls(name) {
    let m = getNoteMeta(name);
    let isArchived = m && m.isArchived;
    if (isSystemNoteName(name) || isArchived) {
      return "italic";
    }
    return "";
  }
</script>

<div
  class="flex bg-gray-200 text-sm px-1 select-none text-gray-900 dark:bg-gray-500 dark:text-gray-300 items-center {cls} hover:visible {klass}"
>
  {#if settings.showSidebar}
    <button
      onclick={() => (settings.showSidebar = false)}
      class="clickable-icon"
      title={"Hide Sidebar"}
    >
      {@render IconMdiArrowCollapseLeft()}
    </button>
  {:else}
    <button
      onclick={() => (settings.showSidebar = true)}
      class="clickable-icon"
      title={"Show Sidebar"}
    >
      {@render IconMdiArrowCollapseRight()}
    </button>
  {/if}

  <button
    onmouseenter={(ev) => {
      menuPos = { x: ev.x, y: ev.y };
      noFocusEditorOnMenuOut = false;
      shwingMenu = true;
    }}
    onmouseleave={() => {
      shwingMenu = false;
      if (!noFocusEditorOnMenuOut) {
        focusEditor();
      }
    }}
    class="clickable-icon relative"
  >
    {@render IconMenu()}
    {#if shwingMenu}
      {@const menuDef = buildMenuDef()}
      <Menu {menuItemStatus} onmenucmd={myOnMenuCmd} {menuDef} pos={null} />
    {/if}
  </button>

  <!-- <button
    onclick={openCommandPalette}
    class="clickable-icon"
    title={fixUpShortcuts("Command Palette (Mod + Shift + K)")}
  >
    {@render IconCommandPalette()}
  </button> -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    onmouseenter={() => (showingHelp = true)}
    onmouseleave={() => {
      showingHelp = false;
      focusEditor();
    }}
    class="clickable-icon px-2 relative"
    title="Documentation"
  >
    ?
    {#if showingHelp}
      <HelpDropDown selectItem={(url) => openURLOrNote(url)}></HelpDropDown>
    {/if}
  </div>

  {#key settings.tabs}
    <div class="flex items-center overflow-hidden">
      {#each settings.tabs as noteName}
        {@const isSelected = noteName == settings.currentNoteName}
        {@const cls = isSelected
          ? "bg-white hover:bg-white! dark:bg-gray-800 dark:hover:bg-gray-800!"
          : "bg-gray-200 dark:bg-gray-500! hover:bg-gray-100 cursor-pointer"}
        {@const noteNameCls = noteCls(noteName)}
        <button
          class="truncate justify-between whitespace-nowrap flex-[1] ml-2 flex dark:bg-gray-700 align-baseline clickable-icon text-gray-500 dark:text-gray-300 dark:hover:bg-gray-500 items-center {cls}"
          onclick={() => openNote(noteName, false)}
          title={getNameWithShortcut(noteName)}
        >
          <div class="max-w-32 truncate {noteNameCls}">
            {noteName}
          </div>
          {#if len(settings.tabs) > 1}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              onclick={(ev) => {
                ev.stopPropagation();
                closeTab(noteName);
              }}
              class="hover:bg-red-300 hover:text-red-600"
            >
              {@render IconTablerX()}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {/key}

  <button
    onclick={() => {
      appState.forceNewTab = true;
      openNoteSelector();
    }}
    class="clickable-icon ml-1 px-1!"
    title={"Open note in a new tab"}
  >
    {@render IconTablerPlus()}
  </button>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onmouseenter={() => (showingQuickAccess = true)}
    onmouseleave={() => {
      showingQuickAccess = false;
      focusEditor();
    }}
    class="clickable-icon mt-[-2px] relative"
  >
    &nbsp;⏷
    {#if showingQuickAccess}
      <QuickAccess openNote={myOpenNote} forHistory={false} />
    {/if}
  </div>
  {#if settings.alwaysShowTopNav}
    <div class="grow"></div>
    <a
      bind:this={ednaRef}
      class="edna mr-2 font-bold text-slate-600 dark:text-slate-200"
      onmouseenter={() => {
        if (!startColor) {
          startColor = ednaRef.style.color;
        }
        colorChangeInterval = setInterval(() => {
          ednaRef.style.color = colors[colorIndex];
          colorIndex = (colorIndex + 1) % colors.length;
        }, 300); // Change color every 500 milliseconds
      }}
      onmouseleave={() => {
        clearInterval(colorChangeInterval);
        ednaRef.style.color = startColor;
      }}
      href="/help"
      target="_blank"
      >Edna
    </a>
    <button
      onclick={() => (settings.alwaysShowTopNav = false)}
      class="clickable-icon"
      title={"Make Navigation Bar Smaller"}
    >
      {@render IconMdiArrowCollapseRight()}
    </button>
  {:else}
    <button
      onclick={() => (settings.alwaysShowTopNav = true)}
      class="clickable-icon"
      title={"Make Navigation Bar Full Size"}
    >
      {@render IconMdiArrowCollapseLeft()}
    </button>
  {/if}
</div>

<style>
  @reference "../main.css";

  .clickable-icon {
    @apply cursor-pointer px-2 py-1;

    &:hover {
      @apply bg-gray-100 dark:bg-gray-500;
    }
  }
</style>
