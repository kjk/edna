import { appState } from "./appstate.svelte";
import { kSettingsPath, kTabHome } from "./constants";
import { arrayRemove, len, objectEqualDeep, platform, pushIfNotExists, throwIf, tryParseJSON } from "./util";

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
  "anthropicKey",
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
  anthropicKey: string;
  // "provider/model id" (see modelKey() in ai-models.ts). Validated against
  // downloaded lists of models (validateAiModelSettings)
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
  anthropicKey: "",
  aiModelID: "",
  starredModels: [],
};

export function createSettings(raw?: any): Settings {
  let s: Settings = {
    ...defaultSettings,
    tabs: [...defaultSettings.tabs],
    starredModels: [...defaultSettings.starredModels],
  };
  if (raw && typeof raw === "object") {
    for (let key of settingsKeys) {
      if (!(key in raw)) {
        continue;
      }
      let v = raw[key];
      let def = (defaultSettings as any)[key];
      // values must have the type of the default (U8): e.g. a non-array tabs
      // crashed boot
      if (Array.isArray(def)) {
        if (!Array.isArray(v)) continue;
        v = v.filter((e: unknown) => typeof e === "string");
      } else if (def === undefined) {
        // optional: fontFamily (string), fontSize (number)
        if (v !== undefined && v !== null && typeof v !== "string" && typeof v !== "number") continue;
      } else if (typeof v !== typeof def) {
        continue;
      }
      (s as any)[key] = v;
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
    return appState.settings;
  }
  let d = localStorage.getItem(kSettingsPath) || "{}";
  // console.log("getSettings: loaded from localStorage:", d);
  // corrupt settings must not leave the app blank (U8): use defaults, keep a copy
  let settingsRaw: any = tryParseJSON(d, "settings", () => localStorage.setItem(kSettingsPath + ".corrupted", d)) ?? {};
  let settings = createSettings(settingsRaw);
  settings.tabSize = validateTabSize(settings.tabSize || 2);
  settings.fontSize = validateFontSize(settings.fontSize || kDefaultFontSize);
  settings.fontFamily = settings.fontFamily || kDefaultFontFamily;

  // console.log("getSettings: settings:", app
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
  if (!settingsLoaded) {
    // nothing to save before settings were loaded by getSettings()
    return false;
  }
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
