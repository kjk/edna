import { SCRATCH_FILE_NAME } from "./common/constants";
import { useHeynoteStore } from "./stores/heynote-store.svelte";
import { copyObj, len, platform, throwIf } from "./util";

let notesStore = useHeynoteStore();

const settingsKeys = [
  "bracketClosing",
  "currentNoteName",
  "emacsMetaKey",
  "fontFamily",
  "fontSize",
  "keymap",
  "showFoldGutter",
  "showLineNumberGutter",
  "useWideSelectors",
  "defaultBlockLanguage",
  "defaultBlockLanguageAutoDetect",
  "theme",
];

export class Settings {
  bracketClosing = $state(true);
  currentNoteName = $state(SCRATCH_FILE_NAME);
  emacsMetaKey = $state("alt");
  /** @type { string} */
  fontFamily = $state(undefined);
  /** @type { number } */
  fontSize = $state(undefined);
  keymap = $state("default");
  showFoldGutter = $state(true);
  showLineNumberGutter = $state(true);
  useWideSelectors = $state(false);
  defaultBlockLanguage = $state("text");
  defaultBlockLanguageAutoDetect = $state(true);
  theme = $state("system"); // "system", "light", "dark"

  constructor(settings) {
    if (!settings) {
      return;
    }
    for (let key of settingsKeys) {
      if (key in settings) {
        this[key] = settings[key];
      }
    }
  }
  toJSON() {
    return copyObj(this, settingsKeys);
  }
}

// TODO: should be "Consolas" instead of "Cascadia Code"?
// TODO: something else for Linux?
export let kDefaultFontFamily = platform.isMac ? "Menlo" : "Cascadia Code";

// TODO: not sure mobile should be so big. Looked big on iPhone
export const isMobileDevice = window.matchMedia("(max-width: 600px)").matches;
export let kDefaultFontSize = isMobileDevice ? 16 : 12;

export const kSettingsPath = "settings.json";

let lastSettings;

/** @returns {Settings} */
export function getSettings() {
  if (notesStore.settings) {
    // console.log("getSettings: already loaded");
    // logSettings(notesStore.settings);
    return notesStore.settings;
  }
  let d = localStorage.getItem(kSettingsPath) || "{}";
  console.log("getSettings: loaded from localStorage:", d);
  let settings = d === null ? {} : JSON.parse(d);
  notesStore.settings = new Settings(settings);
  if (!notesStore.settings.currentNoteName) {
    notesStore.settings.currentNoteName = SCRATCH_FILE_NAME;
  }
  lastSettings = notesStore.settings.toJSON();
  return notesStore.settings;
}

const mediaMatch = window.matchMedia("(prefers-color-scheme: dark)");
function updateWebsiteTheme() {
  // console.log("updateWebsiteTheme, settings.theme:", notesStore.settings.theme);
  let theme = notesStore.settings.theme || "system";
  if (theme === "system") {
    theme = mediaMatch.matches ? "dark" : "light";
  }
  // console.log("setting theme:", theme);
  let el = document.documentElement;
  if (theme === "dark") {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

/**
 * @param {Settings} newSettings
 * @returns {boolean}
 */
function saveSettings(newSettings) {
  // TODO: figure out why this broke during port
  if (!newSettings) {
    console.warn("saveSettings: no newSettings provided");
    return false;
  }
  throwIf(!newSettings.currentNoteName);
  let settings = newSettings.toJSON();
  let changed = [];
  for (let key of settingsKeys) {
    let valLast = lastSettings[key];
    let valNew = settings[key];
    if (valNew !== valLast) {
      changed.push(key);
    }
  }
  if (len(changed) === 0) {
    console.log("saveSettings: no changes");
    return false;
  }
  for (let key of changed) {
    console.log(
      `saveSettings: ${key} changed from ${lastSettings[key]} to ${settings[key]}`,
    );
  }

  // console.log("saveSettings:", s);
  localStorage.setItem(kSettingsPath, JSON.stringify(settings, null, 2));
  lastSettings = settings;
  updateWebsiteTheme();
  return true;
}

$effect.root(() => {
  $effect(() => {
    saveSettings(notesStore.settings);
  });
});

// returns "light" or "dark"
export function getActiveTheme() {
  let el = document.documentElement;
  if (el.classList.contains("dark")) {
    return "dark";
  }
  return "light";
}

export function getOverlayScrollbarOptions() {
  let theme = getActiveTheme();
  // yes, light scrollbar theme for dark theme
  let st = theme === "dark" ? "os-theme-light" : "os-theme-dark";
  return {
    scrollbars: {
      theme: st,
    },
  };
}

mediaMatch.addEventListener("change", async () => {
  if (notesStore.settings.theme === "system") {
    console.log("change event listener");
    updateWebsiteTheme();
  }
});

/**
 * @returns {string}
 */
export function getVersion() {
  // __APP_VERSION__ and __GIT_HASH__ are set in vite.config.js
  // @ts-ignore
  return __APP_VERSION__;
}

/**
 * @returns {string}
 */
export function getGitHash() {
  // @ts-ignore
  return __GIT_HASH__;
}
