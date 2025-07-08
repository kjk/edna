<script>
  import { focus } from "../actions.js";
  import { kLanguages } from "../editor/languages.js";
  import {
    findMatchingItems,
    hilightText,
    len,
    makeHilightRegExp,
  } from "../util.js";
  import ListBox from "./ListBox.svelte";

  /** @type {{
    selectLanguage: (name: string) => void,
  }} */
  let { selectLanguage } = $props();

  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));

  function buildItems() {
    let n = len(kLanguages);
    let res = Array(n);
    let i = 0;
    for (let l of kLanguages) {
      let item = {
        key: l.name,
        token: l.token,
        name: l.name,
        nameLC: l.name.toLowerCase(),
        ref: null,
      };
      res[i++] = item;
    }
    res.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
    res.unshift({
      key: "auto",
      token: "auto",
      name: "Auto-detect",
      nameLC: "auto-detect",
      ref: null,
    });
    return res;
  }
  const items = buildItems();
  let itemsFiltered = $derived(findMatchingItems(items, filter, "nameLC"));
  let listboxRef;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  onkeydown={(ev) => {
    listboxRef.onkeydown(ev, filter === "");
  }}
  tabindex="-1"
  class="selector z-20 absolute center-x-with-translate top-[2rem] max-h-[94vh] flex flex-col p-2"
>
  <input
    use:focus
    type="text"
    bind:value={filter}
    class="py-1 px-2 bg-white w-full min-w-[400px] mb-2 rounded-xs"
  />
  <ListBox
    bind:this={listboxRef}
    items={itemsFiltered}
    onclick={(item) => selectLanguage(item.token)}
  >
    {#snippet renderItem(item)}
      {@const hili = hilightText(item.name, hiliRegExp)}
      <div>{@html hili}</div>
    {/snippet}
  </ListBox>
</form>
