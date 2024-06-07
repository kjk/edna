<script>
  import {
    kDefaultFontFamily,
    kDefaultFontSize,
    getVersion,
    saveSettings,
    setSetting,
    getSettings,
  } from "../settings";
  import { platform } from "../util";
  import { focus } from "../actions";

  /** @type {{
    close: () => void,
}}*/
  let { close } = $props();

  let keymaps = [
    { name: "Default", value: "default" },
    { name: "Emacs", value: "emacs" },
  ];

  let isMac = platform.isMac;

  let initialSettings = getSettings();
  let keymap = $state(initialSettings.keymap);
  let metaKey = $state(initialSettings.emacsMetaKey);
  let showLineNumberGutter = $state(initialSettings.showLineNumberGutter);
  let showFoldGutter = $state(initialSettings.showFoldGutter);
  let bracketClosing = $state(initialSettings.bracketClosing);
  let fontFamily = $state(initialSettings.fontFamily || kDefaultFontFamily);
  let fontSize = $state(initialSettings.fontSize || kDefaultFontSize);
  let theme = $state(initialSettings.theme);

  // console.log("fontFamily:", initialSettings.fontFamily);

  let defFont = [kDefaultFontFamily, kDefaultFontFamily + " (default)"];
  let systemFonts = $state([defFont]);
  let themes = [
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ];

  let defaultFontSize = $state(kDefaultFontSize);
  let appVersion = getVersion();
  let currentNoteName = initialSettings.currentNoteName;

  /** @type {HTMLElement} */
  let container;
  /** @type {HTMLElement} */
  let keymapSelector;

  let fontSizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  $effect(() => {
    updateLocalFonts();
    if (container) {
      container.focus();
    }
    if (keymapSelector) {
      keymapSelector.focus();
    }
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

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    let key = ev.key;
    if (key === "Escape") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      close();
      return;
    }
  }

  function updateTheme() {
    console.log("updateTheme", theme);
    //$emit("setTheme", theme);
    setSetting("theme", theme);
  }

  function updateSettings() {
    saveSettings({
      bracketClosing: bracketClosing,
      currentNoteName: currentNoteName,
      emacsMetaKey: platform.isMac ? metaKey : "alt",
      fontFamily: fontFamily === kDefaultFontFamily ? undefined : fontFamily,
      fontSize: fontSize === kDefaultFontSize ? undefined : fontSize,
      keymap: keymap,
      showFoldGutter: showFoldGutter,
      showLineNumberGutter: showLineNumberGutter,
      theme: theme,
    });
  }
</script>

<div class="fixed inset-0">
  <div class=" absolute inset-0 z-10 bg-black opacity-50 dark:opacity-20"></div>

  <div
    class="selector absolute overflow-auto center-x-with-translate top-[2rem] z-20 flex flex-col max-w-full px-4 py-4 max-h-[94vh] select-none"
  >
    <div>
      <h2>Input settings</h2>
      <label>
        <input
          use:focus
          type="checkbox"
          bind:checked={bracketClosing}
          onchange={updateSettings}
        />
        Auto-close brackets and quotation marks
      </label>
    </div>

    <div class="mt-2 flex flex-col">
      <h2>Gutters</h2>
      <label>
        <input
          type="checkbox"
          bind:checked={showLineNumberGutter}
          onchange={updateSettings}
        />
        Show line numbers
      </label>

      <label>
        <input
          type="checkbox"
          bind:checked={showFoldGutter}
          onchange={updateSettings}
        />
        Show fold gutter
      </label>
    </div>

    <div class="mt-2 flex justify-between">
      <h2>Keymap</h2>
      <select
        bind:this={keymapSelector}
        bind:value={keymap}
        onchange={updateSettings}
      >
        {#each keymaps as km (km.value)}
          <option selected={km.value === keymap} value={km.value}
            >{km.name}</option
          >
        {/each}
      </select>
    </div>

    {#if true || (keymap == "emacs" && isMac)}
      <div class="mt-2 flex justify-between">
        <h2>Meta Key</h2>
        <select bind:value={metaKey} onchange={updateSettings}>
          <option selected={metaKey === "meta"} value="meta">Command</option>
          <option selected={metaKey === "alt"} value="alt">Option</option>
        </select>
      </div>
    {/if}

    <div class="mt-2 flex justify-between">
      <h2>Font Family</h2>
      <select bind:value={fontFamily} onchange={updateSettings}>
        {#each systemFonts as font}
          {@const family = font[0]}
          {@const label = font[1]}
          <option selected={family === fontFamily} value={family}
            >{label}
          </option>
        {/each}
      </select>
    </div>

    <div class="mt-2 flex justify-between">
      <h2>Font Size</h2>
      <select bind:value={fontSize} onchange={updateSettings}>
        {#each fontSizes as size}
          <option selected={size === fontSize} value={size}
            >{size}px{size === defaultFontSize ? " (default)" : ""}</option
          >
        {/each}
      </select>
    </div>

    <div class="mt-2 flex justify-between">
      <h2>Theme</h2>
      <select bind:value={theme} onchange={updateTheme}>
        {#each themes as t}
          {@const th = t[0]}
          {@const label = t[1]}
          <option selected={th === theme} value={th}>{label} </option>
        {/each}
      </select>
    </div>

    <div class="mt-4 flex text-gray-400">
      Current Version: {appVersion}
    </div>

    <button
      tabindex="-1"
      class="mt-2 self-end border border-black dark:border-gray-400 px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-600"
      onclick={close}>Close</button
    >
  </div>
</div>

<style>
  select {
    @apply w-[200px];
    @apply ml-4;
    @apply border;
    @apply border-black;
    @apply px-2 py-1;
  }

  option {
    @apply px-2 py-2;
  }
  h2 ~ label {
    margin-left: 4px;
  }

  label > input[type="checkbox"] {
    position: relative;
    top: 2px;
    left: -3px;
  }
  h2 {
    @apply font-bold;
  }
</style>