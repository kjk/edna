<script lang="ts">
  import { tooltip } from "../actions.js";
  import { appState, findNoteByName } from "../appstate.svelte.js";
  import { focusEditor, openNoteSelector } from "../globals.js";
  import Menu from "../Menu.svelte";
  import { isMoving } from "../mouse-track.svelte.js";
  import { isSystemNoteName } from "../notes.js";
  import { getSettings } from "../settings.svelte.js";
  import { parseTab } from "../tab.js";
  import { getAltChar, len } from "../util.js";
  import HelpDropDown from "./HelpDropDown.svelte";
  import {
    IconGrokIconDown,
    IconMdiArrowCollapseLeft,
    IconMdiArrowCollapseRight,
    IconMenu,
    IconTablerPlus,
    IconTablerX,
  } from "./Icons.svelte";
  import QuickAccess from "./QuickAccess.svelte";

  type MenuDef = import("../Menu.svelte").MenuDef;
  type MenuItemDef = import("../Menu.svelte").MenuItemDef;

  let {
    class: klass = "",
    openTab,
    openNote,
    closeTab,
    buildMenuDef,
    menuItemStatus,
    onmenucmd,
  }: {
    class?: string;
    openTab: (tabStr: string) => void;
    openNote: (name: string, newTab: boolean) => void;
    closeTab: (name: string) => void;
    buildMenuDef: any;
    menuItemStatus?: (mi: MenuItemDef) => number;
    onmenucmd: (cmd: number) => void;
  } = $props();

  let altChar = getAltChar();

  let settings = getSettings();
  let menuTriggerCls = $derived(
    parseTab(settings.currentTab).isNote() ? "" : "invisible",
  );
  function tabTitle(tabStr: string): string {
    let tab = parseTab(tabStr);
    if (tab.isURL()) {
      let uri = tab.value;
      if (uri.startsWith("/")) {
        return uri.substring(1);
      }
    }
    return tab.value;
  }

  function getTabTooltip(tab: string): string {
    if (tab.startsWith("url:")) {
      let uri = tab.substring(4);
      if (uri.startsWith("/")) {
        return uri.substring(1);
      }
    }
    let noteName = tab;
    let note = findNoteByName(noteName);
    if (note && note.altShortcut) {
      return `${noteName}  (${altChar} + ${note.altShortcut})`;
    }
    return noteName;
  }

  function myOpenNote(noteName: string, newTab: boolean): void {
    showingQuickAccess = false;
    openNote(noteName, newTab);
  }

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

  let showingHelp = $state(false);

  function openURLOrNote(url: string): void {
    showingHelp = false;
    if (url.startsWith("system:")) {
      openNote(url, true);
      return;
    }
    if (!url.startsWith("http")) {
      let tabStr = "url:" + url;
      openTab(tabStr);
      return;
      // url = window.location.origin + url;
    }
    window.open(url, "_blank");
  }

  let showingMenu = $state(false);
  let noFocusEditorOnMenuOut = false;
  let menuPos = { x: 0, y: 0 };

  function myOnMenuCmd(cmdid: number): void {
    noFocusEditorOnMenuOut = true;
    showingMenu = false;
    onmenucmd(cmdid);
  }

  function tabCls(tabStr: string): string {
    if (tabStr.startsWith("url:")) {
      return "";
    }
    let noteName = tabStr;
    let note = findNoteByName(noteName);
    let isArchived = note && note.isArchived;
    if (isSystemNoteName(noteName) || isArchived) {
      return "italic";
    }
    return "";
  }
</script>

<div
  class="flex bg-sky-200! text-sm px-1 select-none text-gray-900 dark:bg-gray-500 dark:text-gray-300 items-center {cls} hover:visible {klass}"
>
  {#if settings.showSidebar}
    <button
      onclick={() => (settings.showSidebar = false)}
      class="clickable-icon"
      {@attach tooltip}
      data-tooltip={"Hide Sidebar"}
    >
      {@render IconMdiArrowCollapseLeft()}
    </button>
  {:else}
    <button
      onclick={() => (settings.showSidebar = true)}
      class="clickable-icon"
      {@attach tooltip}
      data-tooltip={"Show Sidebar"}
    >
      {@render IconMdiArrowCollapseRight()}
    </button>
  {/if}

  <button
    onmouseenter={(ev) => {
      menuPos = { x: ev.x, y: ev.y };
      noFocusEditorOnMenuOut = false;
      showingMenu = true;
    }}
    onmouseleave={() => {
      showingMenu = false;
      if (!noFocusEditorOnMenuOut) {
        focusEditor();
      }
    }}
    class="clickable-icon relative {menuTriggerCls}"
  >
    {@render IconMenu()}
    {#if showingMenu}
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
        {@const isSelected = tab == settings.currentTab}
        {@const title = tabTitle(tab)}
        {@const tt = getTabTooltip(tab)}
        {@const cls = isSelected
          ? "bg-white hover:bg-white! dark:bg-gray-800 dark:hover:bg-gray-800!"
          : "bg-sky-200 dark:bg-gray-500! hover:bg-sky-100! cursor-pointer"}
        {@const noteNameCls = tabCls(tab)}
        <button
          {@attach tooltip}
          class="truncate justify-between items-center whitespace-nowrap flex-1 ml-2 flex dark:bg-gray-700 clickable-icon text-gray-500 dark:text-gray-300 dark:hover:bg-gray-500 group {cls}"
          onclick={() => openTab(tab)}
          data-tooltip={tt}
        >
          <div class="max-w-32 truncate {noteNameCls}">
            {title}
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
      {/each}
    </div>
  {/key}

  <button
    onclick={() => {
      appState.forceNewTab = true;
      openNoteSelector();
    }}
    class="clickable-icon ml-1 px-1!"
    {@attach tooltip}
    data-tooltip={"Open note in a new tab"}
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
    {#if !appState.isOnline}
      <div
        class="text-red-600 font-bold mr-2"
        title="Currently offline, no connection to the internet"
      >
        Offline
      </div>
    {/if}

    {#if appState.user}
      <div
        class="clickable-icon relative group flex items-center gap-x-2 px-1 py-1"
      >
        {#if appState.user.avatar_url}
          <img
            class="avatar"
            src={appState.user.avatar_url}
            width="20"
            height="20"
            alt="User avatar"
          />
        {/if}
        <div class="text-sm">{appState.user.login}</div>
        <div class="text-gray-700 -ml-1 flex">
          <div class="mt-0.5">{@render IconGrokIconDown()}</div>
          <div
            class="hidden absolute text-sm flex-col border shadow left-0 top-full py-2 z-20 group-hover:flex bg-white"
          >
            <a
              href="/auth/ghlogout"
              class="hover:bg-gray-100 py-0.5 px-4 min-w-24">Logout</a
            >
          </div>
        </div>
      </div>
    {:else}
      <button
        title="LogIn to access notes from any computer"
        onclick={() => (appState.showingLogin = true)}
        class="relative flex items-center font-bold text-slate-600 dark:text-slate-200 clickable-icon"
      >
        login</button
      >
    {/if}

    <!-- <a
      class="mr-1 font-bold text-slate-600 dark:text-slate-200"
      href="/help"
      target="_blank"
      >Elaris
    </a> -->
    <button
      {@attach tooltip}
      onclick={() => (settings.alwaysShowTopNav = false)}
      class="clickable-icon"
      aria-label={"Make Navigation Bar Smaller"}
    >
      {@render IconMdiArrowCollapseRight()}
    </button>
  {:else}
    <button
      {@attach tooltip}
      onclick={() => (settings.alwaysShowTopNav = true)}
      class="clickable-icon"
      aria-label={"Make Navigation Bar Full Size"}
    >
      {@render IconMdiArrowCollapseLeft()}
    </button>
  {/if}
</div>

<style lang="postcss">
  @reference "../main.css";

  .clickable-icon {
    @apply cursor-pointer px-2 py-1;

    &:hover {
      @apply bg-sky-100 dark:bg-gray-500;
    }
  }
</style>
