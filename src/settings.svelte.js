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
  "currentNoteName",
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
  currentNoteName = $state(kScratchNoteName);
  tabs = $state([]);
  emacsMetaKey = $state("alt");
  /** @type { string} */
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
  addTab(noteName) {
    pushIfNotExists(this.tabs, noteName);
  }
  removeTab(noteName) {
    arrayRemove(this.tabs, noteName);
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
  if (model) {
    return modelID;
  }
  console.warn(`validateAiModelID: model not found for id: ${modelID}`);
  let freeModelID = getFreeModelID();
  return freeModelID;
}

const freeModelsToTry = [
  "grok-4-fast:free",
  "kimi-k2:free",
  "deepseek-chat-v3.1:free",
  "gpt-oss-120b:free",
  "gpt-oss-20b:free",
  "qwen3-coder:free",
  "gemma-3n-e2b-it:free",
  "mistral-small-3.2-24b-instruct:free",
  "kimi-dev-72b:free",
  "deepseek-r1-0528-qwen3-8b:free",
  "deepseek-r1-0528:free",
  "devstral-small-2505:free",
  "gemma-3n-e4b-it:free",
  "llama-3.3-8b-instruct:free",
  "qwen3-4b:free",
  "qwen3-30b-a3b:free",
  "qwen3-8b:free",
  "qwen3-14b:free",
  "qwen3-235b-a22b:free",
  "kimi-vl-a3b-thinking:free",
  "llama-4-maverick:free",
  "llama-4-scout:free",
  "qwen2.5-vl-32b-instruct:free",
  "deepseek-chat-v3-0324:free",
  "mistral-small-3.1-24b-instruct:free",
  "gemma-3-4b-it:free",
  "gemma-3-12b-it:free",
  "gemma-3-27b-it:free",
  "qwq-32b:free",
  "qwen2.5-vl-72b-instruct:free",
  "mistral-small-24b-instruct-2501:free",
  "deepseek-r1-distill-llama-70b:free",
  "deepseek-r1:free",
  "gemini-2.0-flash-exp:free",
  "llama-3.3-70b-instruct:free",
];

function getFreeModelID() {
  for (let modelID of freeModelsToTry) {
    let model = findModelByID(modelID);
    if (model) {
      return modelID;
    }
  }
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
    let m = appState.settings.aiModelID;
    let nm = validateAiModelID(m);
    if (m !== nm) {
      appState.settings.aiModelID = nm;
    }
    return appState.settings;
  }
  let d = localStorage.getItem(kSettingsPath) || "{}";
  // console.log("getSettings: loaded from localStorage:", d);
  let settingsRaw = d === null ? {} : JSON.parse(d);
  let settings = new Settings(settingsRaw);
  settings.tabSize = validateTabSize(settings.tabSize || 2);
  let m = settings.aiModelID;
  if (!findModelByID(m)) {
    console.warn(`getSettings: model not found for id: ${m}, fixing`);
    settings.aiModelID = getFreeModelID();
  }
  settings.aiModelID = validateAiModelID(settings.aiModelID);
  settings.fontSize = validateFontSize(settings.fontSize);
  settings.fontFamily = settings.fontFamily || kDefaultFontFamily;
  settings.starredModels = removeUnknownAiModels(settings.starredModels || []);

  // console.log("getSettings: settings:", app
  if (!settings.currentNoteName) {
    settings.currentNoteName = kScratchNoteName;
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
  throwIf(!newSettings.currentNoteName);
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
