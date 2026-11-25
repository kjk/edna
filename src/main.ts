import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import { mount, unmount, type Component } from "svelte";
import App from "./components/App.svelte";
import AskFSPermissions from "./components/AskFSPermissions.svelte";
import { isTabHome, kTabHome } from "./constants";
import { hasHandlePermission } from "./fileutil";
import { loadNotesMetadata } from "./metadata";
import {
  clearStorageFS,
  createDefaultNotes,
  dbDelDirHandle,
  dbGetDirHandle,
  encryptUnencryptedNotes,
  loadNoteNames,
  noteExists,
  pickAnotherDirectory,
  preLoadAllNotes,
  setStorageFS,
} from "./notes";
import { getSettings, settingsAddTab } from "./settings.svelte";
import { isDev, SerialQueue } from "./util";

// window.onunhandledrejection = console.warn;

let appSvelte: ReturnType<typeof mount> | undefined;

// boots are serialized: e.g. double-clicking "Allow" doesn't run two boots at once
const bootQueue = new SerialQueue();

export function boot(): Promise<void> {
  return bootQueue.run(bootNow);
}

// let the user pick a directory for storing notes and re-boot using it
export async function switchToDirectory(): Promise<void> {
  let ok = await pickAnotherDirectory();
  if (!ok) {
    return;
  }
  await boot();
  await preLoadAllNotes();
}

// stop storing notes in a directory and re-boot using browser storage
export async function switchToBrowserStorage(): Promise<void> {
  await dbDelDirHandle();
  await boot();
}

const storageActions = { boot, switchToBrowserStorage, switchToDirectory };

function mountRoot<Props extends Record<string, unknown>>(component: Component<Props>, props: Props) {
  const target = document.getElementById("app");
  if (!target) return;
  appSvelte = mount(component, { target, props });
}

async function bootNow() {
  console.log("booting");

  if (appSvelte) {
    await unmount(appSvelte);
    appSvelte = undefined;
  }

  getSettings();

  const dh = await dbGetDirHandle();
  try {
    if (dh && !(await hasHandlePermission(dh, true))) {
      clearStorageFS();
      mountRoot(AskFSPermissions, { directory: dh, ...storageActions });
      return;
    }
    setStorageFS(dh);
    await loadNotesMetadata();
    await createDefaultNotes(await loadNoteNames());
    try {
      await encryptUnencryptedNotes();
    } catch (e) {
      // the notes still work unencrypted, don't fail the boot
      console.error("failed to encrypt notes:", e);
    }
  } catch (e) {
    if (!dh) {
      throw e;
    }
    // e.g. directory was deleted or is on a disconnected drive. Show a screen
    // where the user can retry, pick another directory or switch to browser
    // storage, instead of a blank app
    console.error("failed to load notes from directory:", e);
    clearStorageFS();
    mountRoot(AskFSPermissions, { directory: dh, error: String(e), ...storageActions });
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
    return noteExists(name);
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
  mountRoot(App, storageActions);
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

// service worker makes Edna work offline (#16). Not in development because
// it would serve cached files instead of the ones vite rebuilds
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((e) => {
    console.log("service worker registration failed:", e);
  });
}
