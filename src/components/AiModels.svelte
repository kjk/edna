<script lang="ts">
  import { clickOutside, focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import {
    compareTrueFirst,
    filteredCountMsg,
    findMatchingItemsFn,
    handleListKeydown,
    hilightText,
    humanPrice,
    len,
    makeHilightRegExp,
    toggleInArray,
    toggleStarredAndFocus,
  } from "../util";
  import { getAiProvider, modelKey, type AiModel } from "../ai-models";
  import { aiModelsState } from "../ai-models-state.svelte";
  import { StarButton } from "./Icons.svelte";
  import ListBox from "./ListBox.svelte";

  interface Props {
    selectModel: (model: AiModel) => void;
    close: () => void;
  }
  let { close, selectModel }: Props = $props();

  // svelte-ignore non_reactive_update
  let initialSelection = 0;

  let filter = $state("");
  let forceUpdate = $state(0);
  let hiliRegExp = $derived(makeHilightRegExp(filter));
  let sanitizedFilter = $derived(filter.trim());
  let models = $derived(buildModels(aiModelsState.models, sanitizedFilter, forceUpdate));

  function providerName(model: AiModel): string {
    return getAiProvider(model.provider)?.name ?? model.provider;
  }

  function buildModels(items: AiModel[], filter: string, ignore: any): AiModel[] {
    function modelNameFn(model: AiModel) {
      return (providerName(model) + " " + model.name + " " + model.id).toLowerCase();
    }

    let res = findMatchingItemsFn(items, filter, modelNameFn);
    res.sort((a, b) => {
      const starred = appState.settings.starredModels;
      return (
        compareTrueFirst(starred.includes(modelKey(a)), starred.includes(modelKey(b))) ||
        modelNameFn(a).localeCompare(modelNameFn(b))
      );
    });
    return res;
  }

  let listboxComp: ListBox;

  function onkeydown(ev: KeyboardEvent) {
    handleListKeydown(ev, listboxComp, true, (ev) => {
      if (ev.code === "Escape") {
        ev.stopPropagation();
        close();
        return true;
      }
      // hack: space closes the drop-down
      if (ev.code === "Space") {
        ev.preventDefault();
        filter += " ";
        return true;
      }
      return false;
    });
  }

  function toggleModelStarred(model: AiModel) {
    toggleStarredAndFocus(() => {
      toggleInArray(appState.settings.starredModels, modelKey(model));
      forceUpdate++;
    });
  }

  function itemKey(item: AiModel) {
    return modelKey(item);
  }

  // price per token => price per million tokens; "" if not known
  function priceStr(price: number | undefined): string {
    return price === undefined ? "" : humanPrice(price);
  }

  let modelsCountMsg = $derived(filteredCountMsg(len(models), len(aiModelsState.models), "models"));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  use:clickOutside={close}
  {onkeydown}
  tabindex="-1"
  class="absolute flex flex-col pt-1 z-20 text-sm py-2 px-2 bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-500 border rounded-lg focus:outline-hidden top-6 border-gray-400 right-0 max-h-[50vh] min-w-[40ch]"
>
  <div class="relative">
    <input use:focus bind:value={filter} type="text" class="px-1 py-0.5 mb-2 w-full text-xs" />
    <div class="absolute right-2 top-px italic text-gray-400">
      {modelsCountMsg}
    </div>
  </div>
  {#if len(aiModelsState.models) === 0}
    <div class="px-1 py-2 text-gray-500">
      {#if aiModelsState.loading}
        Loading models...
      {:else}
        No models: enter an API key
      {/if}
    </div>
  {/if}
  <ListBox
    bind:this={listboxComp}
    items={models}
    onclick={(model, metaPressed) => {
      selectModel(model);
    }}
    {itemKey}
    {initialSelection}
    compact={true}
  >
    {#snippet renderItem(model, idx)}
      {@const isStarred = appState.settings.starredModels.includes(modelKey(model))}
      {@const nameHili = hilightText(model.name, hiliRegExp)}
      {@const providerHili = hilightText(providerName(model), hiliRegExp)}

      {@render StarButton(isStarred, () => toggleModelStarred(model))}

      <div class="ml-2 min-w-[10ch] whitespace-nowrap text-left">
        {@html providerHili}
      </div>
      <div class="px-1 ml-4 grow truncate text-left min-w-[32ch]">
        {@html nameHili}
      </div>
      <div class="w-[6ch] text-right">{priceStr(model.pricePrompt)}</div>
      <div class="w-[6ch] text-right mr-2">{priceStr(model.priceCompletion)}</div>
    {/snippet}
  </ListBox>
</form>
