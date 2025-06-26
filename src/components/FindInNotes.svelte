<script>
  import { onMount, tick } from "svelte";
  import {
    closeSearchPanel,
    findNext,
    findPrevious,
    getSearchQuery,
    replaceAll,
    replaceNext,
    SearchQuery,
    selectMatches,
    setSearchQuery,
  } from "@codemirror/search";
  import { focus, trapfocus } from "../actions";
  import { isMoving } from "../mouse-track.svelte";
  import { appState } from "../state.svelte";
  import {
    IconFluentWholeWord,
    IconLucideReplace,
    IconLucideReplaceAll,
    IconLucideTextSelect,
    IconTablerArrowDown,
    IconTablerArrowUp,
    IconTablerChevronDown,
    IconTablerChevronRight,
    IconTablerLetterCase,
    IconTablerX,
  } from "./Icons.svelte";

  let searchTerm = $state("");
  let replaceTerm = $state("");
  let showReplace = $state(false);

  /** @type {HTMLInputElement} */
  let searchInputREf;

  /** @type {HTMLInputElement} */
  let replaceInputRef = $state(undefined);

  $effect(() => {});

  function next() {}

  function prev() {}

  function replace() {}
  function _replaceAll() {}

  function toggleShowReplace() {
    showReplace = !showReplace;
    if (showReplace) {
      tick().then(() => replaceInputRef.focus());
    } else {
      tick().then(() => searchInputREf.focus());
    }
  }
  /**
   * @param {KeyboardEvent} ev
   */
  function onKeyDown(ev) {
    if (ev.key == "Enter") {
      if (ev.shiftKey) {
        prev();
      } else {
        next();
      }
      ev.preventDefault();
      return;
    }
  }

  onMount(() => {
    tick().then(() => {
      searchInputREf.select();
    });
    isMoving.disableMoveTracking = true;

    return () => {
      isMoving.disableMoveTracking = false;
    };
  });

  function close() {
    isMoving.disableMoveTracking = false;
  }

  function matchCase() {
    appState.searchMatchCase = !appState.searchMatchCase;
    console.log("matchCase", appState.searchMatchCase);
  }
  function matchWholeWOrd() {
    appState.searchMatchWholeWord = !appState.searchMatchWholeWord;
    console.log("matchWholeWOrd", appState.searchMatchWholeWord);
  }
  function btnPressedCls(isPressed) {
    return isPressed
      ? "bg-gray-100 border-1 border-gray-300"
      : "bg-white border-1 border-white";
  }
  let matchCaseCls = $derived(btnPressedCls(appState.searchMatchCase));
  let matchWholeWordCls = $derived(
    btnPressedCls(appState.searchMatchWholeWord),
  );
</script>

{#snippet InsideInput()}
  <div class="absolute right-[0.25rem] top-[6px] flex">
    <button class={matchCaseCls} onclick={matchCase} title="Match Case"
      >{@render IconTablerLetterCase()}</button
    >
    <button
      class={matchWholeWordCls}
      onclick={matchWholeWOrd}
      title="Match Whole Word">{@render IconFluentWholeWord()}</button
    >
  </div>
{/snippet}

{#snippet NextToInputButtons()}
  <button onclick={next} title="Find Next (Enter}" class="ml-2"
    >{@render IconTablerArrowDown()}</button
  >
  <button onclick={prev} title="Find Previous (Shift + Enter)"
    >{@render IconTablerArrowUp()}</button
  >
  <button onclick={close} title="Close">{@render IconTablerX()}</button>
{/snippet}

{#snippet InputTop()}
  <input
    bind:this={searchInputREf}
    type="text"
    class="w-full"
    spellcheck="false"
    placeholder="Find in notes"
    bind:value={searchTerm}
    use:focus
    onkeydown={onKeyDown}
  />
{/snippet}

{#snippet InputBottom()}
  <input
    bind:this={replaceInputRef}
    type="text"
    spellcheck="false"
    placeholder="Replace"
    bind:value={replaceTerm}
    class="w-full"
  />
{/snippet}

<div
  class="fixed top-[2px] left-1/2 -translate-x-1/2 z-20 px-1 py-1 bg-white text-sm w-4/5 shadow-lg border border-gray-300"
  use:trapfocus
>
  <div class="flex flex-row">
    <div class="flex mr-1">
      {#if showReplace}
        <button onclick={toggleShowReplace} title="hide replace"
          >{@render IconTablerChevronDown()}</button
        >
      {:else}
        <button onclick={toggleShowReplace} title="show replace"
          >{@render IconTablerChevronRight()}</button
        >
      {/if}
    </div>

    <div class="flex flex-col grow">
      <div class="flex">
        <!-- top row -->
        <div class="relative grow">
          {@render InputTop()}
          {@render InsideInput()}
        </div>
        {@render NextToInputButtons()}
      </div>
      {#if showReplace}
        <div class="flex">
          <!-- bottom row -->
          <div class="flex mt-2 grow">
            {@render InputBottom()}
            <button class="ml-2" title="replace" onclick={replace}
              >{@render IconLucideReplace()}</button
            >
            <button title="replace all" onclick={_replaceAll}
              >{@render IconLucideReplaceAll()}</button
            >
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  @reference "../main.css";

  input {
    @apply bg-white px-2 py-1 border-1 border-gray-200 outline-1 outline-gray-200;
  }
  button {
    @apply px-[6px] py-[2px] hover:bg-gray-200;
  }
</style>
