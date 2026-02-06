import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import { mount, unmount } from "svelte";
import App from "./components/App.svelte";
import AskFSPermissions from "./components/AskFSPermissions.svelte";
import { isTabHome, kScratchNoteName, kTabHome } from "./constants";
import { hasHandlePermission } from "./fileutil";
import { loadNotesMetadata, upgradeMetadata } from "./metadata";
import {
  clearStorageFS,
  createDefaultNotes,
  dbGetDirHandle,
  ensureValidNoteNamesFS,
  isSystemNoteName,
  loadNoteNames,
  preLoadAllNotes,
  setStorageFS,
} from "./notes";
import { getSettings, settingsAddTab } from "./settings.svelte";
import { isDev } from "./util";

// window.onunhandledrejection = console.warn;

let appSvelte: ReturnType<typeof mount> | undefined;

export async function boot() {
  console.log("booting");

  getSettings();

  let dh = await dbGetDirHandle();
  if (dh) {
    console.log("storing data in the file system");
    let ok = await hasHandlePermission(dh, true);
    if (!ok) {
      console.log("no permission to write files in directory", dh.name);
      clearStorageFS();
      const target = document.getElementById("app");
      if (!target) return;
      appSvelte = mount(AskFSPermissions, { target });
      return;
    }
  } else {
    console.log("storing data in localStorage");
  }

  if (dh) {
    // TODO: can probably remove
    await ensureValidNoteNamesFS(dh);
  }
  await upgradeMetadata();

  let noteNames = await loadNoteNames();
  let nCreated = await createDefaultNotes(noteNames);
  await loadNotesMetadata(); // pre-load

  let settings = getSettings();
  // console.log("settings:", settings);

  // pick the tab to open at startup:
  // - #${name} from the url
  // - settings.currentTab if it's valid
  // - fallback to home tab
  let toOpenAtStartup: string = kTabHome; // default if nothing else matches
  let nameFromURLHash = window.location.hash.slice(1);
  nameFromURLHash = decodeURIComponent(nameFromURLHash);
  let tabFromSettings = settings.currentTab;

  // re-do because could have created default notes
  if (nCreated > 0) {
    noteNames = await loadNoteNames();
  }

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
  if (appSvelte) {
    unmount(appSvelte);
  }
  const target = document.getElementById("app");
  if (!target) return;
  appSvelte = mount(App, { target });
  // app.use(Toast, {
  //   // transition: "Vue-Toastification__bounce",
  //   transition: "none",
  //   maxToasts: 20,
  //   newestOnTop: true,
  // });
}

boot().then(() => {
  console.log("finished booting");
  preLoadAllNotes().then((n) => {
    console.log(`finished pre-loading ${n} notes`);
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
}
// @ts-ignore
window.testError = function () {
  throw new Error("test error");
};
