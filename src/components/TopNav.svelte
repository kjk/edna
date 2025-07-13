<script>
  import { appState, findNoteByName } from "../appstate.svelte.js";
  import { focusEditor, openNoteSelector } from "../globals.js";
  import Menu from "../Menu.svelte";
  import { isMoving } from "../mouse-track.svelte.js";
  import { isSystemNoteName } from "../notes.js";
  import { getSettings } from "../settings.svelte.js";
  import { getAltChar, len } from "../util.js";
  import GitHub from "./GitHub.svelte";
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
    let note = findNoteByName(noteName);
    if (note && note.altShortcut) {
      return `${noteName}  (${altChar} + ${note.altShortcut})`;
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
    let note = findNoteByName(name);
    let isArchived = note && note.isArchived;
    if (isSystemNoteName(name) || isArchived) {
      return "italic";
    }
    return "";
  }
  function startLogin() {
    console.warn("startLogin NYI");
  }
</script>

<div
  class="flex bg-sky-200! text-sm px-1 select-none text-gray-900 dark:bg-gray-500 dark:text-gray-300 items-center {cls} hover:visible {klass}"
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
          : "bg-sky-200 dark:bg-gray-500! hover:bg-sky-100! cursor-pointer"}
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
    {#if appState.isOffline}
      <div
        class="text-red-600 font-bold mr-2"
        title="Currently offline, no connection to the internet"
      >
        Offline
      </div>
    {/if}

    {#if appState.user}
      <div
        class="clickable-icon relative group flex items-center gap-x-2 px-2 mr-1.5 py-1"
      >
        {#if appState.user.avatar_url}
          <img
            class="avatar"
            src={appState.user.avatar_url}
            width="20"
            height="20"
            alt="kjk"
          />
        {/if}
        <div class="text-sm">{appState.user.login}</div>
        <div class="text-gray-700 ml-[-4px]">
          ⏷
          <div
            class="hidden absolute text-sm flex-col border shadow left-0 top-full py-2 z-20 group-hover:flex bg-white"
          >
            <a
              href="/auth/ghlogout"
              class="hover:bg-gray-100 py-0.5 px-4 min-w-[6rem]">Logout</a
            >
          </div>
        </div>
      </div>
    {:else}
      <a
        title="LogIn with GitHub to access notes from any computer"
        href="/auth/ghlogin"
        class="relative flex items-center mr-4 font-bold text-slate-600 dark:text-slate-200 clickable-icon"
        ><GitHub class="mt-[1px]" />
        <div class="ml-1.5">login</div></a
      >
    {/if}

    <a
      class="mr-1 font-bold text-slate-600 dark:text-slate-200"
      href="/help"
      target="_blank"
      >Elaris
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
      @apply bg-sky-100 dark:bg-gray-500;
    }
  }
</style>
