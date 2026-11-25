<script lang="ts">
  import { focus } from "../actions";
  import { splitCommandLabel } from "../keys";
  import { findMatchingItems, handleListKeydown, hilightText, len, makeHilightRegExp, trimPrefix } from "../util";
  import ListBox from "./ListBox.svelte";
  import { type Command } from "./Menu.svelte";

  interface Props {
    executeCommand: (run: Command["run"]) => void;
    switchToNoteSelector: () => void;
    commandsDef: Command[];
  }
  let { executeCommand, switchToNoteSelector, commandsDef }: Props = $props();

  interface Item {
    key: number;
    run: Command["run"];
    name: string;
    nameLC: string;
    shortcut: string;
  }

  function buildCommands(): Item[] {
    return commandsDef
      .map((command, key) => {
        const { name, shortcut } = splitCommandLabel(command.label);
        return { key, run: command.run, name, nameLC: name.toLowerCase(), shortcut };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
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

  function trimFilter(f: string): string {
    f = f.trim();
    return trimPrefix(f, ">");
  }

  let itemsFiltered = $derived.by(() => {
    return findMatchingItems(items, trimFilter(filter).toLowerCase(), "nameLC");
  });

  function emitExecuteCommand(item: Item) {
    // console.log("emitOpenNote", item);
    executeCommand(item.run);
  }

  let listboxComp: ListBox;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={(ev) => {
    handleListKeydown(ev, listboxComp, filter === "");
  }}
  tabindex="-1"
  class="dlg z-20 absolute center-x-with-translate top-8 flex flex-col max-h-[90vh] w-[42em] max-w-[90vw] p-2"
>
  <div>
    <input type="text" use:focus bind:value={filter} class="py-1 px-2 bg-white w-full mb-2 rounded-xs relative" />
    <div class="absolute right-4 top-3 italic text-gray-400">
      {cmdCountMsg}
    </div>
  </div>
  <ListBox bind:this={listboxComp} items={itemsFiltered} onclick={(item) => emitExecuteCommand(item)}>
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
