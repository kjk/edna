<script module lang="ts">
  export {
    IconMenu,
    IconCommandPalette,
    IconLucideTextSelect,
    IconTablerStar,
    StarButton,
    IconTablerArrowUp,
    IconTablerArrowDown,
    IconTablerLetterCase,
    IconTablerChevronDown,
    IconTablerChevronRight,
    IconTablerX,
    IconFluentWholeWord,
    IconTablerRegex,
    IconLucideReplace,
    IconLucideReplaceAll,
    IconTablerPlus,
    IconMdiArrowCollapseLeft,
    IconMdiArrowCollapseRight,
    IconTablerTrash,
    IconTablerArchive,
    IconGrokIconDown,
    IconTablerHome,
  };
</script>

<!-- single-path, 2px-stroke 24x24 icon (Tabler / Lucide style) -->
{#snippet strokeIcon(d: string, fill = "none", klass = "")}
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" class={klass}
    ><path {fill} stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" {d} /></svg
  >
{/snippet}

<!-- star toggle button in list items; click doesn't propagate to the list -->
{#snippet StarButton(isStarred: boolean, onclick: () => void, cls = "-ml-1.5")}
  <button
    tabindex="-1"
    class="{cls} cursor-pointer hover:text-yellow-600"
    onclick={(ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onclick();
    }}
  >
    {@render IconTablerStar(isStarred ? "var(--color-yellow-300)" : "none")}
  </button>
{/snippet}

<!-- single-path filled icon -->
{#snippet fillIcon(d: string, viewBox = "0 0 24 24")}
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" {viewBox}><path fill="currentColor" {d} /></svg>
{/snippet}

<!--
Icon from Material Design Icons by Pictogrammers - https://github.com/Templarian/MaterialDesign/blob/master/LICENSE

https://icones.js.org/collection/all?s=collapse&icon=mdi:arrow-collapse-right
-->
{#snippet IconMdiArrowCollapseRight()}
  {@render fillIcon("M12.08 4.08L20 12l-7.92 7.92l-1.41-1.42l5.5-5.5H2v-2h14.17l-5.5-5.5zM20 12v10h2V2h-2z")}
{/snippet}

<!--
Icon from Material Design Icons by Pictogrammers - https://github.com/Templarian/MaterialDesign/blob/master/LICENSE

https://icones.js.org/collection/all?s=collapse&icon=mdi:arrow-collapse-left
-->
{#snippet IconMdiArrowCollapseLeft()}
  {@render fillIcon("M11.92 19.92L4 12l7.92-7.92l1.41 1.42l-5.5 5.5H22v2H7.83l5.51 5.5zM4 12V2H2v20h2z")}
{/snippet}

{#snippet IconMenu()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    fill="none"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 6l16 0" />
    <path d="M4 12l16 0" />
    <path d="M4 18l16 0" />
  </svg>
{/snippet}}

{#snippet IconCommandPalette()}
  {@render fillIcon("M3.045 18.894L9.94 12L3.045 5.106a.75.75 0 0 1 1.06-1.061l7.425 7.425a.75.75 0 0 1 0 1.06l-7.424 7.425a.75.75 0 0 1-1.061-1.06Zm8.205.606a.75.75 0 0 0 0 1.5h9.5a.75.75 0 0 0 0-1.5z")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE
https://icones.js.org/collection/tabler?s=archive&icon=tabler:trash
-->

{#snippet IconTablerTrash()}
  {@render strokeIcon("M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE
https://icones.js.org/collection/tabler?s=archive&icon=tabler:archive
-->
{#snippet IconTablerArchive()}
  {@render strokeIcon("M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2m2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h4")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE
https://icones.js.org/collection/tabler?s=plus&icon=tabler:plus
-->
{#snippet IconTablerPlus()}
  {@render strokeIcon("M12 5v14m-7-7h14")}
{/snippet}
<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=arrow+up&icon=tabler:star
-->
{#snippet IconTablerStar(fill = "none", klass = "")}
  {@render strokeIcon("m12 17.75l-6.172 3.245l1.179-6.873l-5-4.867l6.9-1l3.086-6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z", fill, klass)}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=arrow+up&icon=tabler:arrow-up
-->
{#snippet IconTablerArrowUp()}
  {@render strokeIcon("M12 5v14m6-8l-6-6m-6 6l6-6")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=arrow+up&icon=tabler:arrow-down
-->

{#snippet IconTablerArrowDown()}
  {@render strokeIcon("M12 5v14m6-6l-6 6m-6-6l6 6")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=case&icon=tabler:letter-case
-->

{#snippet IconTablerLetterCase()}
  {@render strokeIcon("M14 15.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M3 19V8.5a3.5 3.5 0 0 1 7 0V19m-7-6h7m11-1v7")}
{/snippet}

<!--
Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE
https://icones.js.org/collection/all?s=text-select&icon=lucide:text-select
-->
{#snippet IconLucideTextSelect()}
  {@render strokeIcon("M5 3a2 2 0 0 0-2 2m16-2a2 2 0 0 1 2 2m0 14a2 2 0 0 1-2 2M5 21a2 2 0 0 1-2-2M9 3h1M9 21h1m4-18h1m-1 18h1M3 9v1m18-1v1M3 14v1m18-1v1M7 8h8m-8 4h10M7 16h6")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=select&icon=tabler:chevron-down
-->
{#snippet IconTablerChevronDown()}
  {@render strokeIcon("m6 9l6 6l6-6")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=select&icon=tabler:chevron-right
-->
{#snippet IconTablerChevronRight()}
  {@render strokeIcon("m9 6l6 6l-6 6")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=select&icon=tabler:x
-->
{#snippet IconTablerX()}
  {@render strokeIcon("M18 6L6 18M6 6l12 12")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna
https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/tabler?s=replace&icon=tabler:replace
-->

<!--
Icon from Fluent UI System Icons by Microsoft Corporation - https://github.com/microsoft/fluentui-system-icons/blob/main/LICENSE

https://icones.js.org/collection/fluent?s=whole-word&icon=fluent:text-whole-word-16-regular
-->
{#snippet IconFluentWholeWord()}
  {@render fillIcon("M10 2a.5.5 0 0 0-1 0v9.5a.5.5 0 0 0 1 0v-.1c.418.377.937.6 1.5.6c1.381 0 2.5-1.343 2.5-3s-1.119-3-2.5-3c-.563 0-1.082.223-1.5.6zm3 7c0 1.283-.835 2-1.5 2S10 10.283 10 9s.835-2 1.5-2s1.5.717 1.5 2M7 7.834l-.003-.137c-.054-1.212-.832-1.963-2.139-2.028l-.191-.007c-.753-.014-1.35.122-1.789.43a.499.499 0 1 0 .574.818c.264-.185.715-.275 1.356-.243c.82.041 1.184.406 1.191 1.144a5 5 0 0 0-1.893-.14C2.792 7.83 2 8.684 2 9.834c0 1.304.941 2.167 2.167 2.167c.565 0 1.174-.193 1.833-.57v.07l.005.068a.5.5 0 0 0 .495.432l.068-.005A.5.5 0 0 0 7 11.509zm-2.774.854a4 4 0 0 1 1.571.128v.001l.202.06v1.393l-.165.113c-.656.432-1.214.642-1.668.642c-.692 0-1.167-.436-1.167-1.167c0-.633.405-1.07 1.227-1.17M16 13.5V13a.5.5 0 1 0-1 0v.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V13a.5.5 0 1 0-1 0v.5A1.5 1.5 0 0 0 1.5 15h13a1.497 1.497 0 0 0 1.5-1.5", "0 0 16 16")}
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE

https://icones.js.org/collection/all?s=regex&icon=tabler:regex
-->

{#snippet IconTablerRegex()}
  {@render strokeIcon("M6.5 15a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5M17 7.875l3-1.687m-3 1.687v3.375m0-3.375l-3-1.687m3 1.687l3 1.688M17 4.5v3.375m0 0l-3 1.688")}
{/snippet}

<!--
Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE

https://icones.js.org/collection/all?s=replace-all&icon=lucide:replace-all
-->
{#snippet IconLucideReplaceAll()}
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      ><path
        d="M14 14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2m0-18a2 2 0 0 1 2-2m0 8a2 2 0 0 1-2-2m6 6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2m0-20a2 2 0 0 1 2 2m0 4a2 2 0 0 1-2 2M3 7l3 3l3-3"
      /><path d="M6 10V5a3 3 0 0 1 3-3h1" /><rect width="8" height="8" x="2" y="14" rx="2" /></g
    ></svg
  >
{/snippet}

<!--
Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE

https://icones.js.org/collection/all?s=replace-all&icon=lucide:replace
-->
{#snippet IconLucideReplace()}
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"
    ><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      ><path d="M14 4a2 2 0 0 1 2-2m0 8a2 2 0 0 1-2-2m6-6a2 2 0 0 1 2 2m0 4a2 2 0 0 1-2 2M3 7l3 3l3-3" /><path
        d="M6 10V5a3 3 0 0 1 3-3h1"
      /><rect width="8" height="8" x="2" y="14" rx="2" /></g
    ></svg
  >
{/snippet}

<!--
Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE
https://icones.js.org/collection/tabler?icon=tabler:home
-->
{#snippet IconTablerHome()}
  {@render strokeIcon("M5 12H3l9-9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7m-9 9v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6")}
{/snippet}

<!--
from grok.com
-->
{#snippet IconGrokIconDown()}
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke-width="2"
    class="size-3"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-linecap="square"></path></svg
  >
{/snippet}
