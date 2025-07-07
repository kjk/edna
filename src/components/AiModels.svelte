<script>
  import { clickOutside, focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { toggleNoteStarred } from "../metadata";
  import { getSettings } from "../settings.svelte";
  import {
    arrayRemove,
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
    close: () => void,
  }} */
  let { close, selectModel } = $props();

  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  function modelNameFn(model) {
    return model[kModelNameIdx].toLowerCase();
  }

  let filter = $state("");
  let forceUpdate = $state(0);
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let sanitizedFilter = $derived(filter.trim());
  let models = $derived(
    buildModels(modelsShort, sanitizedFilter, modelNameFn, forceUpdate),
  );

  /**
   * @param {any[]} items
   * @param {string} filter
   * @param {(item) => any} itemKeyFn
   * @param {any} ignore
   * @return {any[]}
   */
  function buildModels(items, filter, itemKeyFn, ignore) {
    let res = findMatchingItemsFn(items, filter, itemKeyFn);
    res.sort((a, b) => {
      const aStarred = appState.settings.starredModels.includes(a[kModelIDIdx]);
      const bStarred = appState.settings.starredModels.includes(b[kModelIDIdx]);
      if (aStarred !== bStarred) {
        return aStarred ? -1 : 1;
      }
      const aName = modelNameFn(a);
      const bName = modelNameFn(b);
      return aName.localeCompare(bName);
    });
    return res;
  }

  let listboxRef;

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    listboxRef.onkeydown(ev, true);
  }

  async function toggleStarred(model) {
    let modelID = model[kModelIDIdx];
    if (appState.settings.starredModels.includes(modelID)) {
      arrayRemove(appState.settings.starredModels, modelID);
      console.warn("unstarred model:", modelID);
    } else {
      appState.settings.starredModels.push(modelID);
      console.warn("starred model:", modelID);
    }
    forceUpdate++;
  }

  function itemKey(item) {
    return item[kModelIDIdx];
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  use:clickOutside={close}
  {onkeydown}
  tabindex="-1"
  class="absolute flex flex-col pt-[4px] z-20 text-sm py-2 px-2 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-500 border rounded-lg focus:outline-hidden top-[24px] border-gray-400 right-0 max-h-[50vh] min-w-[40ch]"
>
  <input bind:value={filter} use:focus class="px-1 py-0.5 mb-2 text-xs" />
  <ListBox
    bind:this={listboxRef}
    items={models}
    onclick={(model, ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      selectModel(model);
    }}
    {itemKey}
    {initialSelection}
    compact={true}
  >
    {#snippet renderItem(model, idx)}
      {@const modelID = model[kModelIDIdx]}
      {@const name = model[kModelNameIdx]}
      {@const providerID = model[kModelProviderIdx]}
      {@const providerName = providersInfo[providerID][1]}
      {@const pricePrompt = humanPrice(model[kModelPricePromptIdx])}
      {@const priceCompletion = humanPrice(model[kModelPriceCompletionIdx])}
      {@const isStarred = appState.settings.starredModels.includes(modelID)}
      {@const hili = hilightText(name, hiliRegExp)}

      <button
        tabindex="-1"
        class="ml-[-6px] cursor-pointer hover:text-yellow-600"
        onclick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleStarred(model);
        }}
      >
        {@render IconTablerStar(isStarred ? "var(--color-yellow-300)" : "none")}
      </button>

      <div class="ml-2 min-w-[10ch] whitespace-nowrap text-left">
        {providerName}
      </div>
      <div class="px-1 ml-4 grow truncate text-left min-w-[32ch]">
        {@html hili}
      </div>
      <div class="w-[6ch] text-right">{pricePrompt}</div>
      <div class="w-[6ch] text-right mr-2">{priceCompletion}</div>
    {/snippet}
  </ListBox>
</form>
