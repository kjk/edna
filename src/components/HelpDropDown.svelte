<script>
  import { focus } from "../actions";
  import { kReleaseNotesSystemNoteName } from "../notes";
  import ListBox from "./ListBox.svelte";

  /** @type {{ 
    selectItem: (name: string) => void,
  }} */
  let { selectItem } = $props();

  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  let listboxRef;

  let items = [
    {
      name: "Documentation",
      key: "/help",
    },
    {
      name: "Keyboard shortcuts",
      key: "/help#keyboard-shortcuts",
    },
    {
      name: "Release notes",
      key: kReleaseNotesSystemNoteName,
    },
    {
      name: "GitHub",
      key: "https://github.com/kjk/edna",
    },
    {
      name: "Contact Me",
      key: "https://blog.kowalczyk.info/contactme",
    },
  ];

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    listboxRef.onkeydown(ev, true);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  use:focus
  class="absolute flex flex-col mt-[-2px] z-20 text-sm p-2 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-500 border rounded-lg focus:outline-hidden center-x-with-translate"
>
  <ListBox
    bind:this={listboxRef}
    {items}
    onclick={(item) => selectItem(item.key)}
    {initialSelection}
    compact={false}
  >
    {#snippet renderItem(item, idx)}
      <div
        title={item.key}
        class="text-left px-1 grow self-end max-w-[32ch] truncate"
      >
        {item.name}
      </div>
    {/snippet}
  </ListBox>
</form>
