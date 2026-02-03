<script lang="ts">
  import { focus } from "../actions";
  import { extractShortcut } from "../keys";
  import {
    findMatchingItems,
    hilightText,
    isDev,
    len,
    makeHilightRegExp,
    splitMax,
    trimPrefix,
  } from "../util";
  import ListBox from "./ListBox.svelte";

  /** @typedef {[string, number]} CmdDef */

  /** @type {{
    executeCommand: (id: number) => void,
    switchToNoteSelector: () => void,
    commandsDef: CmdDef[],
}}*/
  let { executeCommand, switchToNoteSelector, commandsDef } = $props();

  /** @typedef {{
   key: number,
   name: string,
   nameLC: string,
   shortcut: string,
   ref: HTMLElement,
  }} Item
   */

  function verifyCommandsAreUnique() {
    let m = new Map();
    for (let i = 0; i < len(commandsDef); i++) {
      let s = commandsDef[i][0];
      let id = commandsDef[i][1];
      if (m.has(id)) {
        console.log(`Duplicate items with id ${id}: '${s}' and '${m.get(id)}'`);
      }
      m.set(id, s);
    }
  }

  /**
   * @returns {Item[]}
   */
  function buildCommands() {
    if (isDev()) {
      verifyCommandsAreUnique();
    }

    // console.log("rebuildCommands:", commands);
    /** @type {Item[]} */
    let res = Array(len(commandsDef));
    for (let i = 0; i < len(commandsDef); i++) {
      let s = commandsDef[i][0];
      let id = commandsDef[i][1];
      let parts = splitMax(s, "\t", 2);
      let name = parts[0];
      let shortcut = null;
      if (len(parts) > 1) {
        shortcut = extractShortcut(parts[1]);
      }
      // console.log(`i: ${i}, name: ${name} id: ${id}`);
      let item = {
        key: id,
        name: name,
        nameLC: name.toLowerCase(),
        shortcut: shortcut,
        ref: null,
      };
      res[i] = item;
    }
    // -1 if a < b
    // 0 if a = b
    // 1 if a > b
    res.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    return res;
  }
  let items = $state(buildCommands());
  let cmdCountMsg = `${len(items)} commands`;
  let filter = $state(">");
  let hiliRegExp = $derived(makeHilightRegExp(trimFilter(filter)));

  $effect(() => {
    if (filter === "") {
      switchToNoteSelector();
    }
  });

  /**
   * @param {string} f
   * @returns {string}
   */
  function trimFilter(f) {
    f = f.trim();
    return trimPrefix(f, ">");
  }

  let itemsFiltered = $derived.by(() => {
    let lc = filter.toLowerCase();
    lc = trimPrefix(lc, ">");
    return findMatchingItems(items, lc, "nameLC");
  });

  /**
   * @param {Item} item
   */
  function emitExecuteCommand(item) {
    // console.log("emitOpenNote", item);
    executeCommand(item.key);
  }

  let listboxRef;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={(ev) => {
    let allowLeftRight = filter === "";
    listboxRef.onkeydown(ev, allowLeftRight);
  }}
  tabindex="-1"
  class="selector z-20 absolute center-x-with-translate top-8 flex flex-col max-h-[90vh] w-[42em] max-w-[90vw] p-2"
>
  <div>
    <input
      type="text"
      use:focus
      bind:value={filter}
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs relative"
    />
    <div class="absolute right-4 top-3 italic text-gray-400">
      {cmdCountMsg}
    </div>
  </div>
  <ListBox
    bind:this={listboxRef}
    items={itemsFiltered}
    onclick={(item) => emitExecuteCommand(item)}
  >
    {#snippet renderItem(item)}
      {@const hili = hilightText(item.name, hiliRegExp)}
      <div class="truncate">
        {@html hili}
      </div>
      <div class="grow"></div>
      {#if item.shortcut}
        <div class="mr-2 kbd">{item.shortcut}</div>
      {:else}
        <div class="mr-2"></div>
      {/if}
    {/snippet}
  </ListBox>
</form>
