<script lang="ts">
  import { appState } from "../appstate.svelte";
  import { isTabHome, kTabHome } from "../constants";
  import { focusEditor } from "../globals";
  import { getNoteMeta } from "../metadata";
  import { isMoving } from "../mouse-track.svelte";
  import { isSystemNoteName } from "../notes";
  import { getSettings } from "../settings.svelte";
  import { getAltChar, len } from "../util";
  import HelpDropDown from "./HelpDropDown.svelte";
  import {
    IconGrokIconDown,
    IconMdiArrowCollapseLeft,
    IconMdiArrowCollapseRight,
    IconMenu,
    IconTablerHome,
    IconTablerPlus,
    IconTablerX,
  } from "./Icons.svelte";
  import Menu, { type MenuDef, type MenuItemDef } from "./Menu.svelte";
  import QuickAccess from "./QuickAccess.svelte";

  interface Props {
    class?: string;
    openNote: (name: string, newTab: boolean) => void;
    closeTab: (name: string) => void;
    openNoteSelector: () => void;
    buildMenuDef: () => MenuDef;
    menuItemStatus?: (mi: MenuItemDef) => number;
    onmenucmd: (cmd: number) => void;
  }
  let {
    class: klass = "",
    openNote,
    closeTab,
    openNoteSelector,
    buildMenuDef,
    menuItemStatus,
    onmenucmd,
  }: Props = $props();

  let altChar = getAltChar();

  function getNameWithShortcut(noteName: string): string {
    let m = getNoteMeta(noteName);
    if (m && m.altShortcut) {
      return `${noteName}  (${altChar} + ${m.altShortcut})`;
    }
    return noteName;
  }

  function myOpenNote(noteName: string, newTab?: boolean) {
    showingQuickAccess = false;
    openNote(noteName, newTab || false);
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

  let ednaRef: HTMLElement | undefined = $state();

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
  let colorChangeInterval = 0;
  let startColor = "";

  let showingHelp = $state(false);

  function openURLOrNote(url: string) {
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
  function myOnMenuCmd(cmdid: number) {
    noFocusEditorOnMenuOut = true;
    shwingMenu = false;
    onmenucmd(cmdid);
  }

  function noteCls(name: string) {
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
    <button onclick={() => (settings.showSidebar = false)} class="clickable-icon" title={"Hide Sidebar"}>
      {@render IconMdiArrowCollapseLeft()}
    </button>
  {:else}
    <button onclick={() => (settings.showSidebar = true)} class="clickable-icon" title={"Show Sidebar"}>
      {@render IconMdiArrowCollapseRight()}
    </button>
  {/if}

  <button
    onmouseenter={(ev) => {
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
      {#each settings.tabs as tab}
        {@const isHome = isTabHome(tab)}
        {@const isSelected = tab == settings.currentTab}
        {@const cls = isSelected
          ? "bg-white hover:bg-white! dark:bg-gray-800 dark:hover:bg-gray-800!"
          : "bg-gray-200 dark:bg-gray-500! hover:bg-gray-100 cursor-pointer"}
        {@const tabNameCls = isHome ? "" : noteCls(tab)}
        {#if isHome}
          <button
            class="ml-2 flex items-center self-stretch px-3 cursor-pointer text-gray-500 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-500 hover:bg-gray-100 {cls}"
            onclick={() => (settings.currentTab = kTabHome)}
            title="Home"
          >
            {@render IconTablerHome()}
          </button>
        {:else}
          <button
            class="truncate justify-between items-center whitespace-nowrap flex-1 ml-2 flex dark:bg-gray-700 clickable-icon text-gray-500 dark:text-gray-300 dark:hover:bg-gray-500 group {cls}"
            onclick={() => openNote(tab, false)}
            title={getNameWithShortcut(tab)}
          >
            <div class="max-w-32 truncate {tabNameCls}">
              {tab}
            </div>
            {#if len(settings.tabs) > 1}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                onclick={(ev) => {
                  ev.stopPropagation();
                  closeTab(tab);
                }}
                class="hover:bg-red-300 hover:text-red-600 invisible group-hover:visible flex"
              >
                {@render IconTablerX()}
              </div>
            {/if}
          </button>
        {/if}
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
    class="clickable-icon -mt-0.5 relative"
  >
    <div class="mt-0.5">{@render IconGrokIconDown()}</div>
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
          startColor = ednaRef!.style.color;
        }
        colorChangeInterval = window.setInterval(() => {
          ednaRef!.style.color = colors[colorIndex];
          colorIndex = (colorIndex + 1) % colors.length;
        }, 300); // Change color every 500 milliseconds
      }}
      onmouseleave={() => {
        window.clearInterval(colorChangeInterval);
        ednaRef!.style.color = startColor;
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

<style lang="postcss">
  @reference "tailwindcss";

  .clickable-icon {
    @apply cursor-pointer px-2 py-1;

    &:hover {
      @apply bg-gray-100 dark:bg-gray-500;
    }
  }
</style>
