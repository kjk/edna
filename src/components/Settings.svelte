<script>
  import { focus } from "../actions";
  import { getSessionDur } from "../globals";
  import {
    getGitHash,
    getSettings,
    getVersion,
    kDefaultFontFamily,
    kDefaultFontSize,
  } from "../settings.svelte";
  import { platform } from "../util";

  let keymaps = [
    { name: "Default", value: "default" },
    { name: "Emacs", value: "emacs" },
  ];

  let isMac = platform.isMac;

  let settings = getSettings();

  let defFont = [kDefaultFontFamily, kDefaultFontFamily + " (default)"];
  let systemFonts = $state([defFont]);
  let themes = [
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ];

  let spaces = [
    [1, "1 space"],
    [2, "2 spaces"],
    [3, "3 spaces"],
    [4, "4 spaces"],
    [5, "5 spaces"],
    [6, "6 spaces"],
    [7, "7 spaces"],
    [8, "8 spaces"],
  ];

  let indentWith = [
    ["tabs", "Tabs"],
    ["spaces", "Spaces"],
  ];

  let defaultFontSize = $state(kDefaultFontSize);
  let appVersion = getVersion();
  let gitHash = getGitHash();
  let gitURL = "https://github.com/kjk/edna/commit/" + gitHash;

  let fontSizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  $effect(() => {
    updateLocalFonts();
    window.addEventListener("keydown", onkeydown);
    return () => {
      window.removeEventListener("keydown", onkeydown);
    };
  });

  async function updateLocalFonts() {
    // @ts-ignore
    let qlf = window.queryLocalFonts;
    if (!qlf) {
      return;
    }
    let a = [defFont];
    let fonts = await qlf();
    let seen = []; // queryLocalFonts() returns duplicates
    for (let f of fonts) {
      /** @type {string} */
      let fam = f.family;
      if (fam === kDefaultFontFamily) {
        continue;
      }
      if (seen.includes(fam)) {
        continue;
      }
      // console.log("fam:", fam);
      a.push([fam, fam]);
      seen.push(fam);
    }
    systemFonts = a;
  }
</script>

<div
  class="selector absolute overflow-auto center-x-with-translate top-[2rem] z-20 flex flex-col w-[68ch] max-w-full px-4 py-4 select-none"
>
  <div>
    <h2>Input settings</h2>
    <label>
      <input use:focus type="checkbox" bind:checked={settings.bracketClosing} />
      Auto-close brackets and quotation marks
    </label>
  </div>

  <div class="mt-2 flex items-center">
    <h2 class="w-[12ch] text-right">Indent With</h2>
    <select bind:value={settings.indentType}>
      {#each indentWith as t}
        {@const th = t[0]}
        {@const label = t[1]}
        <option selected={th === settings.indentType} value={th}
          >{label}
        </option>
      {/each}
    </select>
  </div>

  <div class="mt-2 flex items-center">
    <h2 class="w-[12ch] text-right">Tab Size</h2>
    <select bind:value={settings.tabSize}>
      {#each spaces as t}
        {@const th = t[0]}
        {@const label = t[1]}
        <option selected={th === settings.tabSize} value={th}>{label} </option>
      {/each}
    </select>
  </div>

  <div class="mt-2 flex flex-col">
    <h2>Gutters</h2>
    <label>
      <input type="checkbox" bind:checked={settings.showLineNumberGutter} />
      Show line numbers
    </label>

    <label>
      <input type="checkbox" bind:checked={settings.showFoldGutter} />
      Show fold gutter
    </label>
  </div>

  <div class="mt-2 flex items-center">
    <h2 class="w-[12ch] text-right">Keymap</h2>
    <select bind:value={settings.keymap}>
      {#each keymaps as km (km.value)}
        <option selected={km.value === settings.keymap} value={km.value}
          >{km.name}</option
        >
      {/each}
    </select>
  </div>

  {#if settings.keymap == "emacs" && isMac}
    <div class="mt-2 flex items-center">
      <h2 class="w-[12ch] text-right">Meta Key</h2>
      <select bind:value={settings.emacsMetaKey}>
        <option selected={settings.emacsMetaKey === "meta"} value="meta"
          >Command</option
        >
        <option selected={settings.emacsMetaKey === "alt"} value="alt"
          >Option</option
        >
      </select>
    </div>
  {/if}

  <div class="mt-2 flex items-center">
    <h2 class="w-[12ch] text-right">Font Family</h2>
    <select bind:value={settings.fontFamily}>
      {#each systemFonts as font}
        {@const family = font[0]}
        {@const label = font[1]}
        <option selected={family === settings.fontFamily} value={family}
          >{label}
        </option>
      {/each}
    </select>
  </div>

  <div class="mt-2 flex items-center">
    <h2 class="w-[12ch] text-right">Font Size</h2>
    <select bind:value={settings.fontSize}>
      {#each fontSizes as size}
        <option selected={size === settings.fontSize} value={size}
          >{size}px{size === defaultFontSize ? " (default)" : ""}</option
        >
      {/each}
    </select>
  </div>

  <div class="mt-2 flex items-center">
    <h2 class="w-[12ch] text-right">Theme</h2>
    <select bind:value={settings.theme}>
      {#each themes as t}
        {@const th = t[0]}
        {@const label = t[1]}
        <option selected={th === settings.theme} value={th}>{label} </option>
      {/each}
    </select>
  </div>

  <div class="mt-2 flex flex-col">
    <h2>AI API Keys</h2>

    <label class="flex items-center mt-2">
      <div class="font-bold w-[11ch] text-right">OpenAI</div>
      <input
        class="grow ml-2 px-1 py-0.5"
        type="text"
        bind:value={settings.openAIKey}
      />
    </label>

    {#if false}
      <label class="flex items-center mt-2">
        <div class="font-bold w-[11ch] text-right">Grok</div>
        <input
          class="grow ml-2 px-1 py-0.5"
          type="text"
          bind:value={settings.grokKey}
        />
      </label>

      <label class="flex items-center mt-2">
        <div class="font-bold w-[11ch] text-right">Anthropic</div>
        <input
          class="grow ml-2 px-1 py-0.5"
          type="text"
          bind:value={settings.anthropicKey}
        />
      </label>

      <label class="flex items-center mt-2">
        <div class="font-bold w-[11ch] text-right">OpenRouter</div>
        <input
          class="grow ml-2 px-1 py-0.5"
          type="text"
          bind:value={settings.openRouterKey}
        />
      </label>
    {/if}
  </div>

  <div class="mt-2 flex flex-col">
    <h2>Misc</h2>
    <label class="flex">
      <input type="checkbox" bind:checked={settings.useWideSelectors} />
      <div>Use wide selectors</div>
    </label>
    <label class="flex">
      <input type="checkbox" bind:checked={settings.alwaysShowTopNav} />
      <div>Always show top navigation bar</div>
    </label>
    <label class="flex">
      <input type="checkbox" bind:checked={settings.showSidebar} />
      <div>Show sidebar</div>
    </label>
  </div>

  <div class="mt-2 mr-0.5 flex text-xs justify-end text-gray-400">
    Current Version: {appVersion}&nbsp;
    <a href={gitURL} target="_blank" class="underline underline-offset-2"
      >{gitHash}</a
    >
  </div>
  <div class="mt-0.5 mr-0.5 flex text-xs justify-end text-gray-400">
    Session: {getSessionDur()}
  </div>
</div>

<style>
  @reference "../main.css";

  select {
    @apply w-[200px];
    @apply ml-4;
    @apply border border-gray-400;
    @apply px-1 py-1;
  }

  option {
    @apply px-2 py-4;
  }

  label {
    @apply flex;
  }

  input[type="checkbox"] {
    @apply mr-2;
  }

  h2 {
    @apply font-bold;
  }
</style>
