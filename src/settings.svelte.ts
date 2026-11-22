import { appState } from "./appstate.svelte";
import { kSettingsPath, kTabHome } from "./constants";
import { kModelIDIdx, modelsShort } from "./models-short";
import { arrayRemove, len, objectEqualDeep, platform, pushIfNotExists, throwIf } from "./util";

const settingsKeys = [
  "bracketClosing",
  "showColorPreview",
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

export interface Settings {
  bracketClosing: boolean;
  showColorPreview: boolean;
  currentTab: string;
  tabs: string[];
  emacsMetaKey: string;
  fontFamily?: string;
  fontSize?: number;
  keymap: string;
  showFoldGutter: boolean;
  showLineNumberGutter: boolean;
  useWideSelectors: boolean;
  alwaysShowTopNav: boolean;
  showSidebar: boolean;
  tabSize: number;
  indentType: string;
  theme: string;
  openAIKey: string;
  xAIKey: string;
  openRouterKey: string;
  aiModelID: string;
  starredModels: string[];
}

export const defaultSettings: Settings = {
  bracketClosing: true,
  showColorPreview: true,
  currentTab: kTabHome,
  tabs: [],
  emacsMetaKey: "alt",
  fontFamily: undefined,
  fontSize: undefined,
  keymap: "default",
  showFoldGutter: true,
  showLineNumberGutter: true,
  useWideSelectors: false,
  alwaysShowTopNav: true,
  showSidebar: false,
  tabSize: 2,
  indentType: "spaces",
  theme: "system",
  openAIKey: "",
  xAIKey: "",
  openRouterKey: "",
  aiModelID: "chatgpt-4o-latest",
  starredModels: ["grok-3", "chatgpt-4o-latest"],
};

export function createSettings(raw?: any): Settings {
  let s: Settings = {
    ...defaultSettings,
    tabs: [...defaultSettings.tabs],
    starredModels: [...defaultSettings.starredModels],
  };
  if (raw) {
    for (let key of settingsKeys) {
      if (key in raw) {
        (s as any)[key] = raw[key];
      }
    }
    // backward compat: migrate currentNoteName -> currentTab
    if (raw.currentNoteName && !raw.currentTab) {
      s.currentTab = raw.currentNoteName;
    }
  }
  return s;
}

export function settingsAddTab(settings: Settings, noteName: string) {
  pushIfNotExists(settings.tabs, noteName);
}

export function settingsRemoveTab(settings: Settings, noteName: string) {
  arrayRemove(settings.tabs, noteName);
}

// TODO: should be "Consolas" instead of "Cascadia Code"?
// TODO: something else for Linux?
export let kDefaultFontFamily = platform.isMac ? "Menlo" : "Cascadia Code";

// TODO: not sure mobile should be so big. Looked big on iPhone
export const isMobileDevice = window.matchMedia("(max-width: 600px)").matches;
// heynote has 12 but Hack at 12 looks like Consolas at 14
export let kDefaultFontSize = isMobileDevice ? 16 : 14;
console.log("kDefaultFontSize:", kDefaultFontSize);

function validateFontSize(fontSize: number): number {
  if (!fontSize) {
    return kDefaultFontSize;
  }
  if (fontSize < 8) {
    return 8;
  }
  return fontSize;
}

function validateTabSize(tabSize: number): number {
  if (tabSize < 1) {
    return 1;
  }
  if (tabSize > 8) {
    return 8;
  }
  return tabSize;
}

export function findModelByID(modelID: string): any[] | undefined {
  for (let m of modelsShort) {
    if (m[kModelIDIdx] == modelID) {
      return m;
    }
  }
}

function validateAiModelID(modelID: string): string | undefined {
  let model = findModelByID(modelID);
  if (model) {
    return modelID;
  }
  console.warn(`validateAiModelID: model not found for id: ${modelID}`);
  let freeModelID = getFreeModelID();
  return freeModelID;
}

// in order of preference. Must exist in modelsShort (re-check after re-generating it)
const freeModelsToTry = [
  "kimi-k2:free",
  "gpt-oss-120b:free",
  "gpt-oss-20b:free",
  "qwen3-coder:free",
  "gemma-3n-e2b-it:free",
  "gemma-3n-e4b-it:free",
  "qwen3-4b:free",
  "qwen3-235b-a22b:free",
  "mistral-small-3.1-24b-instruct:free",
  "gemma-3-4b-it:free",
  "gemma-3-12b-it:free",
  "gemma-3-27b-it:free",
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

function removeUnknownAiModels(modelIDs: string[]): string[] {
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

const mediaMatch = window.matchMedia("(prefers-color-scheme: dark)");
// OS dark mode, for "system" theme
// note: can't be in appState because appstate.svelte.ts imports this module
let systemTheme = $state({ isDark: mediaMatch.matches });

let lastSettingsRaw: any;
let settingsLoaded = false;

export function getSettings(): Settings {
  if (settingsLoaded) {
    // console.log("getSettings: already loaded");
    // logSettings(appState.settings);
    let m = appState.settings.aiModelID;
    let nm = validateAiModelID(m);
    if (nm && m !== nm) {
      appState.settings.aiModelID = nm;
    }
    return appState.settings;
  }
  let d = localStorage.getItem(kSettingsPath) || "{}";
  // console.log("getSettings: loaded from localStorage:", d);
  let settingsRaw = d === null ? {} : JSON.parse(d);
  let settings = createSettings(settingsRaw);
  settings.tabSize = validateTabSize(settings.tabSize || 2);
  let m = settings.aiModelID;
  if (!findModelByID(m)) {
    console.warn(`getSettings: model not found for id: ${m}, fixing`);
    let mid = getFreeModelID();
    if (mid) {
      settings.aiModelID = mid;
    }
  }
  settings.aiModelID = validateAiModelID(settings.aiModelID) || "";
  settings.fontSize = validateFontSize(settings.fontSize || kDefaultFontSize);
  settings.fontFamily = settings.fontFamily || kDefaultFontFamily;
  settings.starredModels = removeUnknownAiModels(settings.starredModels || []);

  // console.log("getSettings: settings:", app
  // backward compat: migrate currentNoteName -> currentTab
  if ((settings as any).currentNoteName && !settings.currentTab) {
    settings.currentTab = (settings as any).currentNoteName;
    delete (settings as any).currentNoteName;
  }
  if (!settings.currentTab) {
    settings.currentTab = kTabHome;
  }
  lastSettingsRaw = $state.snapshot(settings);

  appState.settings = settings;
  settingsLoaded = true;
  updateWebsiteTheme();
  return appState.settings;
}

// resolves "system" theme to "light" or "dark"
export function resolveTheme(theme: string | undefined): "light" | "dark" {
  if (!theme || theme === "system") {
    return systemTheme.isDark ? "dark" : "light";
  }
  return theme === "dark" ? "dark" : "light";
}

function updateWebsiteTheme() {
  let theme = resolveTheme(appState.settings.theme);
  let el = document.documentElement;
  if (theme === "dark") {
    el.classList.add("dark");
  } else {
    el.classList.remove("dark");
  }
}

function saveSettings(newSettings: Settings): boolean {
  throwIf(!newSettings.currentTab);
  newSettings.tabSize = validateTabSize(newSettings.tabSize);
  let settingsRaw = $state.snapshot(newSettings);
  let changed: string[] = [];
  for (let key of settingsKeys) {
    let valLast = lastSettingsRaw[key];
    // @ts-ignore
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
    let v = (settingsRaw as any)[key];
    console.log(`saveSettings: ${key} changed from ${lastSettingsRaw[key]} to ${v}`);
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

mediaMatch.addEventListener("change", () => {
  systemTheme.isDark = mediaMatch.matches;
  if (appState.settings.theme === "system") {
    updateWebsiteTheme();
  }
});

export function getVersion(): string {
  // __APP_VERSION__ and __GIT_HASH__ are set in vite.config.js
  // @ts-ignore
  return __APP_VERSION__;
}

export function getGitHash(): string {
  // @ts-ignore
  return __GIT_HASH__;
}
