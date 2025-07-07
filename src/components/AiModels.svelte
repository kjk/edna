<script>
  import { focus } from "../actions";
  import { toggleNoteStarred } from "../metadata";
  import {
    findMatchingItemsFn,
    hilightText,
    humanPrice,
    len,
    makeHilightRegExp,
  } from "../util";
  import {
    kModelIDIdx,
    kModelNameIdx,
    kModelPriceCompletionIdx,
    kModelPricePromptIdx,
    kModelProviderIdx,
    modelsShort,
    providersInfo,
  } from "./../models-short";
  import { IconTablerStar } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  /** @type {{ 
    selectModel: (model: any) => void,
  }} */
  let { selectModel } = $props();

  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  function modelNameFn(model) {
    return model[kModelNameIdx].toLowerCase();
  }

  let filter = $state("");
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let sanitizedFilter = $derived(filter.trim());
  let models = $derived(buildModels(modelsShort, sanitizedFilter, modelNameFn));

  /**
   * @param {any[]} items
   * @param {string} filter
   * @param {(item) => any} itemKeyFn
   * @return {any[]}
   */
  function buildModels(items, filter, itemKeyFn) {
    return findMatchingItemsFn(items, filter, itemKeyFn);
  }

  let listboxRef;

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    listboxRef.onkeydown(ev, true);
  }

  async function toggleStarred(noteInfo) {
    // there's a noticeable UI lag when we do the obvious:
    // item.isStarred = toggleNoteStarred(item.name);
    // because we wait until metadata file is saved
    // this version makes an optimistic change to reflect in UI
    // and, just to be extra sure, reflects the state after saving
    noteInfo.isStarred = !noteInfo.isStarred;
    toggleNoteStarred(noteInfo.name).then((isStarred) => {
      // not really necessary, should be in-sync
      noteInfo.isStarred = isStarred;
    });
  }
  function itemKey(item) {
    return item[kModelIDIdx];
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  {onkeydown}
  tabindex="-1"
  class="absolute flex flex-col pt-[4px] z-20 text-sm py-2 px-2 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-500 border rounded-lg focus:outline-hidden top-full border-gray-400 right-0 max-h-[50vh] min-w-[40ch]"
>
  <input bind:value={filter} use:focus class="px-1 py-0.5 mb-2 text-xs" />
  <ListBox
    bind:this={listboxRef}
    items={models}
    onclick={(model, ev) => {
      console.log("clicked model:", model);
      ev.preventDefault();
      ev.stopPropagation();
      selectModel(model);
    }}
    {itemKey}
    {initialSelection}
    compact={true}
  >
    {#snippet renderItem(model, idx)}
      {@const name = model[kModelNameIdx]}
      {@const providerID = model[kModelProviderIdx]}
      {@const providerName = providersInfo[providerID][1]}
      {@const pricePrompt = humanPrice(model[kModelPricePromptIdx])}
      {@const priceCompletion = humanPrice(model[kModelPriceCompletionIdx])}
      {@const hili = hilightText(name, hiliRegExp)}

      <div class="">{providerName}</div>
      <div class="px-1 ml-2 grow truncate text-right">
        {@html hili}
      </div>
      <div class="w-[6ch] text-right">{pricePrompt}</div>
      <div class="w-[6ch] text-right mr-2">{priceCompletion}</div>
    {/snippet}
  </ListBox>
</form>
