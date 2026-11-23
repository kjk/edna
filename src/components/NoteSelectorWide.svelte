<script lang="ts">
  import { focus } from "../actions";
  import { getAltChar, hilightText } from "../util";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";
  import { buildVisibleNoteInfos, NoteFilter, noteShortcutStr } from "./NoteSelector.svelte";

  interface Props {
    openNote: (name: string, newTab: boolean) => void;
    createNote: (name: string) => void;
    deleteNote: (name: string, showNotif: boolean) => Promise<void>;
    switchToCommandPalette: () => void;
    switchToRegularNoteSelector: () => void;
  }
  let { openNote, createNote, deleteNote, switchToCommandPalette, switchToRegularNoteSelector }: Props = $props();

  const nf = new NoteFilter(
    () => buildVisibleNoteInfos(),
    () => ({ openNote, createNote, deleteNote }),
    () => switchToCommandPalette(),
  );
  let altChar = getAltChar();

  function onKeydown(ev: KeyboardEvent) {
    if (nf.handleKeydown(ev)) {
      return;
    }
    let allowLeftRight = nf.filter === "" || isCursorAtEnd(nf.input!);
    listboxComp.onkeydown(ev, allowLeftRight);
  }

  function isCursorAtEnd(input: HTMLInputElement) {
    const cursorPosition = input.selectionStart;
    const inputLength = input.value.length;
    return cursorPosition === inputLength;
  }

  let listboxComp: ListBox;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={onKeydown}
  tabindex="-1"
  class="dlg z-20 absolute center-x-with-translate top-8 flex flex-col max-h-[90vh] w-[95vw] p-2"
>
  <div>
    <input
      bind:this={nf.input}
      bind:value={nf.filter}
      use:focus
      type="text"
      class="py-1 px-2 bg-white w-full mb-2 rounded-xs"
    />
    <div class="absolute right-4 top-3 italic text-gray-400">
      {nf.countMsg}
    </div>
  </div>

  <ListBox
    bind:this={listboxComp}
    layout="inline"
    items={nf.filtered}
    selectionChanged={nf.selectionChanged}
    onclick={(item: any, metaPressed: boolean) => nf.openNote(item, metaPressed)}
  >
    {#snippet renderItem(item)}
      {@const hili = hilightText(item.name, nf.hiliRegExp)}
      {#if item.isStarred}
        {@render IconTablerStar("var(--color-yellow-300)", "inline-block mt-[-3px]")}
      {/if}
      {@html hili}
      <span class="ml-0.5 mr-0.5 text-xs text-gray-400 whitespace-nowrap">{noteShortcutStr(item)}</span>
    {/snippet}
  </ListBox>

  <div
    class="flex flex-row items-baseline justify-between mt-2 text-xs max-w-full bg-gray-100 dark:bg-gray-700 rounded-lg py-1 px-2"
  >
    {#if nf.actions.canOpenSelected}
      <div class="flex items-baseline">
        <div class="kbd">Enter</div>
        <div class="ml-2 mr-2">open</div>
      </div>
      <div class="text-gray-400">&bull;</div>
    {/if}

    {#if nf.actions.canCreate}
      <div class="flex items-baseline">
        <div class="kbd">{nf.createKey}</div>
        <div class="ml-2">
          create <span class="font-bold truncate">
            {nf.filter}
          </span>
        </div>
      </div>
      {#if !nf.actions.canCreateWithEnter}
        <div class="text-gray-400">&bull;</div>
      {/if}
    {/if}

    {#if nf.actions.canOpenSelected}
      <div class="flex items-baseline">
        <div class="kbd">Ctrl + Delete</div>
        {#if nf.actions.canDeleteSelected}
          <div class="ml-2 red">delete</div>
        {:else}
          <div class="ml-2 red">
            can't delete <span class="font-bold truncate">{nf.selectedName}</span>
          </div>
        {/if}
      </div>
    {/if}

    {#if nf.actions.canOpenSelected}
      <div class="text-gray-400">&bull;</div>
      <div class="flex items-baseline">
        <div class="kbd">{altChar} 1...9</div>
        <div class="ml-2">assign quick access shortcut</div>
      </div>

      <div class="text-gray-400">&bull;</div>
      <div class="flex items-baseline">
        <div class="kbd">{altChar} + S</div>
        <div class="ml-2">toggle favorite</div>
      </div>
    {/if}

    <div class="text-gray-400">&bull;</div>
    <div class="flex items-baseline">
      <div class="kbd">Esc</div>
      <div class="ml-2">dismiss</div>
    </div>

    <div class="text-gray-400">&bull;</div>
    <div class="flex items-baseline">
      <button
        onclick={(ev) => {
          ev.preventDefault();
          switchToRegularNoteSelector();
        }}
        class="link"
        title="switch to regualar note dlg">regular</button
      >
    </div>
  </div>
</form>
