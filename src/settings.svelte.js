import { appState } from "./appstate.svelte";
import { kModelIDIdx, modelsShort } from "./models-short";
import { kScratchNoteName } from "./notes";
import {
  arrayRemove,
  copyObj,
  len,
  objectEqualDeep,
  platform,
  pushIfNotExists,
  throwIf,
} from "./util";

const settingsKeys = [
  "bracketClosing",
  "currentTab",
  "tabs",
  "emacsMetaKey",
  "fontFamily",
  "fontSize",
  "keymap",
  "showFoldGutter",
  "showLineNumberGutter",
  "useWideSelectors",
  "alwaysShowTopNav",
  "showSidebar",
  "tabSize",
  "indentType",
  "theme",
  "openAIKey",
  "xAIKey",
  "openRouterKey",
  "aiModelID",
  "starredModels",
];

export class Settings {
  bracketClosing = $state(true);
  currentTab = $state(kScratchNoteName);
  /** @type { string[] } */
  tabs = $state([]);
  emacsMetaKey = $state("alt");
  /** @type { string } */
  fontFamily = $state(undefined);
  /** @type { number } */
  fontSize = $state(undefined);
  keymap = $state("default");
  showFoldGutter = $state(true);
  showLineNumberGutter = $state(true);
  useWideSelectors = $state(false);
  alwaysShowTopNav = $state(true);
  showSidebar = $state(false);
  tabSize = $state(2);
  indentType = $state("spaces"); // "tabs" or "spaces"
  theme = $state("system"); // "system", "light", "dark"
  openAIKey = $state("");
  xAIKey = $state("");
  openRouterKey = $state("");
  aiModelID = $state("chatgpt-4o-latest");
  starredModels = $state(["grok-3", "chatgpt-4o-latest"]);

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
  /**
   * @param {string} tab
   */
  addTab(tab) {
    pushIfNotExists(this.tabs, tab);
  }
  /**
   * @param {string} tab
   */
  removeTab(tab) {
    arrayRemove(this.tabs, tab);
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
// heynote has 12 but Hack at 12 looks like Consolas at 14
export let kDefaultFontSize = isMobileDevice ? 16 : 14;
console.log("kDefaultFontSize:", kDefaultFontSize);
export const kSettingsPath = "settings.json";

function validateFontSize(fontSize) {
  if (!fontSize) {
    return kDefaultFontSize;
  }
  if (fontSize < 8) {
    return 8;
  }
  return fontSize;
}

function validateTabSize(tabSize) {
  if (tabSize < 1) {
    return 1;
  }
  if (tabSize > 8) {
    return 8;
  }
  return tabSize;
}

/**
 * @param {string} modelID
 * @returns {any[]}
 */
export function findModelByID(modelID) {
  for (let m of modelsShort) {
    if (m[kModelIDIdx] == modelID) {
      return m;
    }
  }
  return null;
}

/**
 * @param {string} modelID
 * @returns {string}
 */
function validateAiModelID(modelID) {
  let model = findModelByID(modelID);
  if (model === null) {
    console.warn(`validateAiModelID: model not found for id: ${modelID}`);
    return "chatgpt-4o-latest";
  }
  return modelID;
}

/**
 * @param {string[]} modelIDs
 * @returns {string[]}
 */
function removeUnknownAiModels(modelIDs) {
  let validModels = [];
  for (let modelID of modelIDs) {
    let model = findModelByID(modelID);
    if (model) {
      validModels.push(modelID);
    } else {
      console.warn(`removeUnknownAiModels: model not found for id: ${modelID}`);
    }
  }
  return validModels;
}

let lastSettingsRaw;

/** @returns {Settings} */
export function getSettings() {
  if (appState.settings) {
    // console.log("getSettings: already loaded");
    // logSettings(appState.settings);
    return appState.settings;
  }
  let d = localStorage.getItem(kSettingsPath) || "{}";
  // console.log("getSettings: loaded from localStorage:", d);
  let settingsRaw = d === null ? {} : JSON.parse(d);
  let settings = new Settings(settingsRaw);
  settings.tabSize = validateTabSize(settings.tabSize || 2);
  settings.aiModelID = validateAiModelID(settings.aiModelID);
  settings.fontSize = validateFontSize(settings.fontSize);
  settings.fontFamily = settings.fontFamily || kDefaultFontFamily;
  settings.starredModels = removeUnknownAiModels(settings.starredModels || []);

  // console.log("getSettings: settings:", app
  if (!settings.currentTab) {
    settings.currentTab = kScratchNoteName;
  }
  lastSettingsRaw = $state.snapshot(settings.toJSON());

  appState.settings = settings;
  return appState.settings;
}

const mediaMatch = window.matchMedia("(prefers-color-scheme: dark)");
function updateWebsiteTheme() {
  // console.log("updateWebsiteTheme, settings.theme:", appState.settings.theme);
  let theme = appState.settings.theme || "system";
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
  if (!lastSettingsRaw) {
    // prevent exeption due to HMR
    return false;
  }
  throwIf(!newSettings.currentTab);
  newSettings.tabSize = validateTabSize(newSettings.tabSize);
  let settingsRaw = $state.snapshot(newSettings.toJSON());
  let changed = [];
  for (let key of settingsKeys) {
    let valLast = lastSettingsRaw[key];
    let valNew = settingsRaw[key];
    if (!objectEqualDeep(valNew, valLast)) {
      changed.push(key);
    }
  }
  if (len(changed) === 0) {
    console.log("saveSettings: no changes");
    return false;
  }
  for (let key of changed) {
    console.log(
      `saveSettings: ${key} changed from ${lastSettingsRaw[key]} to ${settingsRaw[key]}`,
    );
  }

  // console.log("saveSettings:", s);
  localStorage.setItem(kSettingsPath, JSON.stringify(settingsRaw, null, 2));
  lastSettingsRaw = settingsRaw;
  updateWebsiteTheme();
  return true;
}

$effect.root(() => {
  $effect(() => {
    saveSettings(appState.settings);
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
  if (appState.settings.theme === "system") {
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
