import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import { mount, unmount } from "svelte";
import App from "./components/App.svelte";
import AskFSPermissions from "./components/AskFSPermissions.svelte";
import { isTabHome, kTabHome } from "./constants";
import { hasHandlePermission } from "./fileutil";
import { loadNotesMetadata, upgradeMetadata } from "./metadata";
import {
  clearStorageFS,
  createDefaultNotes,
  dbGetDirHandle,
  isSystemNoteName,
  loadNoteNames,
  preLoadAllNotes,
} from "./notes";
import { getSettings, settingsAddTab } from "./settings.svelte";
import { isDev } from "./util";

// window.onunhandledrejection = console.warn;

let appSvelte: ReturnType<typeof mount> | undefined;

// boots are serialized: e.g. double-clicking "Allow" doesn't run two boots at once
let bootQueue: Promise<void> = Promise.resolve();

export function boot(): Promise<void> {
  let p = bootQueue.then(bootNow);
  bootQueue = p.catch(() => {});
  return p;
}

function mountRoot(component: any, props: Record<string, unknown> = {}) {
  if (appSvelte) {
    unmount(appSvelte);
    appSvelte = undefined;
  }
  const target = document.getElementById("app");
  if (!target) return;
  appSvelte = mount(component, { target, props });
}

async function bootNow() {
  console.log("booting");

  getSettings();

  let dh = await dbGetDirHandle();
  if (dh) {
    console.log("storing data in the file system");
    let ok = await hasHandlePermission(dh, true);
    if (!ok) {
      console.log("no permission to write files in directory", dh.name);
      clearStorageFS();
      mountRoot(AskFSPermissions);
      return;
    }
  } else {
    console.log("storing data in localStorage");
  }

  let noteNames: string[];
  try {
    await upgradeMetadata();
    noteNames = await loadNoteNames();
    let nCreated = await createDefaultNotes(noteNames);
    if (nCreated > 0) {
      noteNames = await loadNoteNames();
    }
    await loadNotesMetadata(); // pre-load
  } catch (e) {
    if (!dh) {
      throw e;
    }
    // e.g. directory was deleted or is on a disconnected drive. Show a screen
    // where the user can retry, pick another directory or switch to browser
    // storage, instead of a blank app
    console.error("failed to load notes from directory:", e);
    clearStorageFS();
    mountRoot(AskFSPermissions, { error: String(e) });
    return;
  }

  let settings = getSettings();
  // console.log("settings:", settings);

  // pick the tab to open at startup:
  // - #${name} from the url
  // - settings.currentTab if it's valid
  // - fallback to home tab
  let toOpenAtStartup: string = kTabHome; // default if nothing else matches
  let nameFromURLHash = window.location.hash.slice(1);
  try {
    nameFromURLHash = decodeURIComponent(nameFromURLHash);
  } catch {
    // e.g. a hand-typed "#50%off" (U8)
    console.warn("invalid URL hash:", nameFromURLHash);
  }
  let tabFromSettings = settings.currentTab;

  function isValidNote(name: string): boolean {
    if (!name) {
      return false;
    }
    return noteNames.includes(name) || isSystemNoteName(name);
  }

  function isValidTab(tab: string): boolean {
    if (isTabHome(tab)) return true;
    return isValidNote(tab);
  }

  // need to do this twice to make sure hashName takes precedence over settings.currentTab
  if (isValidTab(tabFromSettings)) {
    toOpenAtStartup = tabFromSettings;
    console.log("will open tab from settings.currentTab:", tabFromSettings);
  }
  if (isValidNote(nameFromURLHash)) {
    toOpenAtStartup = nameFromURLHash;
    console.log("will open note from url #hash:", nameFromURLHash);
  }

  // will open this tab in App.svelte on mounted()
  settings.currentTab = toOpenAtStartup;
  // ensure home tab is always present and first
  if (!settings.tabs.includes(kTabHome)) {
    settings.tabs.unshift(kTabHome);
  }
  if (!isTabHome(toOpenAtStartup)) {
    settingsAddTab(settings, toOpenAtStartup);
  }

  // remove non-existing notes from tabs (skip home tab)
  let nTabs = settings.tabs.length;
  for (let i = nTabs - 1; i >= 0; i--) {
    let tab = settings.tabs[i]!;
    if (isTabHome(tab)) continue;
    if (!isValidNote(tab)) {
      console.warn(`removing tab ${tab} because no note of that name`);
      settings.tabs.splice(i, 1);
    }
  }

  console.log("mounting App");
  mountRoot(App);
}

boot().then(() => {
  console.log("finished booting");
  preLoadAllNotes()
    .then((n) => {
      console.log(`finished pre-loading ${n} notes`);
    })
    .catch((e) => {
      console.log("preLoadAllNotes failed:", e);
    });
});

if (isDev()) {
  // @ts-ignore
  window.resetApp = function () {
    console.log("unmounting app");
    if (appSvelte) unmount(appSvelte);
    console.log("clearing localStorage");
    localStorage.clear();
    console.log("reloading");
    window.location.reload();
  };
  // @ts-ignore
  window.testError = function () {
    throw new Error("test error");
  };
}
