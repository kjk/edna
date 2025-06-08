import { cloneObjectDeep, objectEqualDeep, platform, throwIf } from "./util";

import { ipcRenderer } from "./ipcrenderer";
import { kScratchNoteName } from "./notes";

/** @typedef {{
  bracketClosing: boolean,
  currentNoteName: string,
  emacsMetaKey: string,
  fontFamily?: string,
  fontSize?: number,
  keymap: string,
  showFoldGutter: boolean,
  showLineNumberGutter: boolean,
  useWideSelectors: boolean,
  theme?: string, // "system", "light", "dark"
  showQuickNoteAccess: boolean,
}} Settings */

export const kEventSettingsChange = "settings-change";

// TODO: should be "Consolas" instead of "Cascadia Code"?
// TODO: something else for Linux?
export let kDefaultFontFamily = platform.isMac ? "Menlo" : "Cascadia Code";

// TODO: not sure mobile should be so big. Looked big on iPhone
export const isMobileDevice = window.matchMedia("(max-width: 600px)").matches;
export let kDefaultFontSize = isMobileDevice ? 16 : 12;

export const kSettingsPath = "settings.json";

// current settings, kept in sync with persisted settings
// shouldn't be modified directly but via setSetting)
/** @type {Settings} */
let settings;

/**
 * @returns {Settings}
 */
export function getSettings() {
  throwIf(!settings);
  return settings;
}

/**
 * @returns {Settings}
 */
export function loadSettings() {
  let d = localStorage.getItem(kSettingsPath) || "{}";
  // also set settings to the latest version
  let settings = d === null ? {} : JSON.parse(d);
  localStorage.removeItem("theme"); // TODO: temporary, theme moved to settings object
  return settings;
}

const mediaMatch = window.matchMedia("(prefers-color-scheme: dark)");
export function updateWebsiteTheme() {
  console.log("updateWebsiteTheme, settings.theme:", settings.theme);
  let theme = settings.theme || "system";
  if (theme === "system") {
    theme = mediaMatch.matches ? "dark" : "light";
  }
  console.log("setting theme:", theme);
  let el = document.documentElement;
  if (theme === "dark") {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

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
  if (settings.theme === "system") {
    console.log("change event listener");
    updateWebsiteTheme();
  }
});

/**
 * @param {Settings} newSettings
 * @returns {boolean}
 */
export function saveSettings(newSettings) {
  console.log("saveSettings:", newSettings);
  throwIf(!newSettings.currentNoteName);
  if (objectEqualDeep(settings, newSettings)) {
    console.log("saveSettings: no change");
    return false;
  }
  let s = JSON.stringify(newSettings, null, 2);
  localStorage.setItem(kSettingsPath, s);
  settings = newSettings;
  updateWebsiteTheme();
  ipcRenderer.send(kEventSettingsChange, newSettings);
  return true;
}

export function loadInitialSettings() {
  let settings = loadSettings();
  console.log("settings loaded:", settings);
  if (!settings.currentNoteName) {
    settings.currentNoteName = kScratchNoteName;
  }

  // ensure all possible settings are present. Start with defaults and overwrite with persisted settings
  /** @type {Settings} */
  let initialSettings = {
    bracketClosing: true,
    currentNoteName: kScratchNoteName,
    emacsMetaKey: "alt",
    keymap: "default",
    showFoldGutter: true,
    showLineNumberGutter: true,
    useWideSelectors: false,
    theme: "system",
    showQuickNoteAccess: false,
  };
  let updatedSettings = Object.assign(initialSettings, settings);
  saveSettings(updatedSettings);
}

/**
 * @param {string} key
 * @param {any} value
 */
export function setSetting(key, value) {
  console.log("setSetting:", key, value);
  let s = cloneObjectDeep(settings);
  s[key] = value;
  saveSettings(s);
}

export function onSettingsChange(callback) {
  ipcRenderer.on(kEventSettingsChange, (event, settings) => callback(settings));
}

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
