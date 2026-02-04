<script lang="ts">
  import {
    getLanguage,
    getLanguageNameFromToken,
    langSupportsFormat,
    langSupportsRun,
  } from "../editor/languages";
  import { fixUpShortcuts } from "../key-helper";
  import { fmtSize, getScrollbarWidth } from "../util";
  import CurrentTime from "./CurrentTime.svelte";

  interface Props {
    line?: number;
    column?: number;
    docSize?: number;
    selectionSize?: number;
    language?: string;
    languageAuto?: boolean;
    isSpellChecking?: boolean;
    openLanguageSelector: () => void;
    toggleSpellCheck: (ev: Event) => void;
    smartRun: (ev: Event) => void;
    formatCurrentBlock: (ev: Event) => void;
  }
  let {
    line = 0,
    column = 0,
    docSize = 0,
    selectionSize = 0,
    language = "",
    languageAuto = false,
    isSpellChecking = false,
    openLanguageSelector,
    toggleSpellCheck,
    smartRun,
    formatCurrentBlock,
  }: Props = $props();

  let style = $state("");
  $effect(() => {
    let dx = getScrollbarWidth();
    style = `right: ${dx}px`;
  });

  let languageName = $derived(getLanguageNameFromToken(language));

  let lang = $derived(getLanguage(language));
  let supportsFormat = $derived(langSupportsFormat(lang));
  let supportsRun = $derived(langSupportsRun(lang));
  // TODO: depend on platform
  let formatBlockTitle = $derived(
    fixUpShortcuts(`Format Block (Alt + Shift + F)`),
  );
  let runBlockTitle = $derived.by(() => {
    let s = "Smart Run";
    if (selectionSize > 0) {
      s = "Run Function With Selection";
    } else if (supportsRun) {
      s = "Run Code Block";
    } else {
      s = "Run Function With Block Content";
    }
    s += fixUpShortcuts(` (Mod + E)`);
    return s;
  });
  let formatSize = $derived(fmtSize(docSize));
  let changeLanguageTitle = $derived(
    fixUpShortcuts(`Change language for current block (Mod + L)`),
  );
</script>

<div
  {style}
  class="fixed bottom-0 text-[9pt] flex justify-end items-center z-10 px-1 select-none dark:text-gray-300 border-gray-300 dark:border-gray-500 border-t border-l rounded-tl-lg bg-white dark:bg-gray-700"
>
  <div class="px-1" title="Cursor: line {line} column {column}">
    Ln <span class="num">{line}</span>
    &nbsp;Col <span class="num">{column}</span>
    {#if selectionSize > 0}
      Sel <span class="num">{selectionSize}</span>
    {/if}
  </div>
  <div class="text-gray-400">&bull;</div>
  <div class="doc-size px-[6px]" title="Note Size: {docSize} bytes">
    {formatSize}
  </div>

  <div class="text-gray-400">&bull;</div>
  <button
    onclick={toggleSpellCheck}
    class="clickable"
    title="Toggle spell check"
  >
    <span
      >Spell check is {#if isSpellChecking}on{:else}off{/if}</span
    >
  </button>
  <div class="text-gray-400">&bull;</div>
  <button
    onclick={openLanguageSelector}
    class="clickable"
    title={changeLanguageTitle}
  >
    {languageName}
    {#if languageAuto}
      <span class="auto">(auto)</span>
    {/if}
  </button>
  <div class="text-gray-400">&bull;</div>
  <button onclick={smartRun} class="clickable" title={runBlockTitle}>
    Smart Run
  </button>

  {#if supportsFormat}
    <div class="text-gray-400">&bull;</div>
    <button
      title={formatBlockTitle}
      aria-label={formatBlockTitle}
      onclick={formatCurrentBlock}
      class="clickable-icon"
    >
      <svg
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.75 4.5a.75.75 0 0 0 0 1.5h14.5a.75.75 0 0 0 0-1.5H2.75ZM2.75 7.5a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5ZM2.75 10.5a.75.75 0 0 0 0 1.5h6.633a1.496 1.496 0 0 1-.284-1.5H2.75ZM2.75 13.5h6.628L7.876 15H2.75a.75.75 0 0 1 0-1.5ZM14.496 7.439a.5.5 0 0 0-.992 0l-.098.791a2.5 2.5 0 0 1-2.176 2.176l-.791.098a.5.5 0 0 0 0 .992l.791.098a2.5 2.5 0 0 1 2.176 2.176l.098.791a.5.5 0 0 0 .992 0l.098-.791a2.5 2.5 0 0 1 2.176-2.176l.791-.098a.5.5 0 0 0 0-.992l-.791-.098a2.5 2.5 0 0 1-2.176-2.176l-.098-.791ZM11.853 13.147a.5.5 0 0 1 0 .707l-4 3.996a.5.5 0 0 1-.706-.707l3.999-3.997a.5.5 0 0 1 .707 0Z"
        >
        </path>
      </svg>
    </button>
  {/if}
  <div class="text-gray-400">&bull;</div>
  <CurrentTime class="ml-1 mr-1"></CurrentTime>
</div>

<style scoped>
  .clickable,
  .clickable-icon {
    cursor: pointer;

    padding-inline: 6px; /* px-[6px]; */
    padding-block: 4px; /* py-[4px]; */

    &:hover {
      background-color: var(--color-gray-100); /* bg-gray-100 */
    }
  }

  .clickable-icon {
    padding-inline: 4px;
  }

  :global(html.dark) .clickable,
  :global(html.dark) .clickable-icon {
    &:hover {
      background-color: var(--color-gray-500); /* bg-gray-500 */
    }
  }
</style>
