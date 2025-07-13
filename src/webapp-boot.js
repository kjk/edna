import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import { mount, unmount } from "svelte";
import { appState, findNoteByName } from "./appstate.svelte";
import App from "./components/App.svelte";
import { updateAfterNoteStateChange } from "./globals";
import { getLoggedUser } from "./login";
import { loadAppMetadata } from "./metadata";
import {
  createDefaultNotes,
  isSystemNoteName,
  kScratchNoteName,
} from "./notes";
import { getSettings } from "./settings.svelte";
import { openStore } from "./store";
import { isDev } from "./util";

/** @typedef {import("./settings.svelte").Settings} Settings */

// window.onunhandledrejection = console.warn;

let appSvelte;

function resetApp() {
  console.log("unmounting app");
  unmount(appSvelte);
  console.log("clearing localStorage");
  localStorage.clear();
  console.log("reloading");
  window.location.reload();
}

async function deleteBrowserStorage() {
  const root = await navigator.storage.getDirectory();
  // @ts-ignore
  for await (const name of root.keys()) {
    await root.removeEntry(name, { recursive: true });
  }
  console.log("OPFS cleared.");
}

async function listBrowserStorage() {
  try {
    const root = await navigator.storage.getDirectory();
    console.log("OPFS Root Contents:");

    // @ts-ignore
    for await (const [name, handle] of root.entries()) {
      if (handle.kind === "file") {
        let f = await handle.getFile();
        console.log(
          `File: ${name}, size: ${f.size} bytes, modified: ${f.lastModifiedDate}`,
        );
      } else if (handle.kind === "directory") {
        console.log(`Directory: ${name}`);
      }
    }
  } catch (error) {
    console.error("Error accessing OPFS:", error);
  }
}

function setupWindowDebug() {
  if (!isDev) {
    return;
  }
  // for ad-hoc use by me during development and debugging
  globalThis.debug = {
    listBrowserStorage: listBrowserStorage,
    deleteBrowserStorage: deleteBrowserStorage,
    resetApp: resetApp,
  };
}

export async function boot() {
  console.log("booting");
  setupWindowDebug();
  // await testFuncs();

  getSettings();
  appState.allNotes = await openStore();
  updateAfterNoteStateChange();
  await loadAppMetadata(); // pre-load

  let user = await getLoggedUser();
  console.log("user:", user);
  appState.user = user;

  await createDefaultNotes(appState.allNotes);

  let settings = getSettings();
  // console.log("settings:", settings);

  // pick the note to open at startup:
  // - #${name} from the url
  // - settings.currentNoteName if it exists
  // - fallback to scratch note
  let toOpenAtStartup = kScratchNoteName; // default if nothing else matches
  let nameFromURLHash = window.location.hash.slice(1);
  nameFromURLHash = decodeURIComponent(nameFromURLHash);
  let nameFromSettings = settings.currentNoteName;

  /**
   * @param {string} name
   * @returns {boolean}
   */
  function isValidNote(name) {
    if (!name) {
      return false;
    }
    let note = findNoteByName(name);
    if (note) {
      return true;
    }
    return isSystemNoteName(name);
  }

  // need to do this twice to make sure hashName takes precedence over settings.currentNoteName
  if (isValidNote(nameFromSettings)) {
    toOpenAtStartup = nameFromSettings;
    console.log(
      "will open note from settings.currentNoteName:",
      nameFromSettings,
    );
  }
  if (isValidNote(nameFromURLHash)) {
    toOpenAtStartup = nameFromURLHash;
    console.log("will open note from url #hash:", nameFromURLHash);
  }
  if (!isValidNote(nameFromSettings)) {
    toOpenAtStartup = kScratchNoteName;
  }

  // will open this note in Editor.vue on mounted()
  settings.currentNoteName = toOpenAtStartup;
  settings.addTab(toOpenAtStartup);

  // remove non-existing notes from tabs
  let nTabs = settings.tabs.length;
  for (let i = nTabs - 1; i >= 0; i--) {
    let noteName = settings.tabs[i];
    if (!isValidNote(noteName)) {
      console.warn(`removing tab ${noteName} becase no note of that name`);
      settings.tabs.splice(i, 1);
    }
  }

  console.log("mounting App");
  if (appSvelte) {
    unmount(appSvelte);
  }
  const args = {
    target: document.getElementById("app"),
  };
  appSvelte = mount(App, args);
  // app.use(Toast, {
  //   // transition: "Vue-Toastification__bounce",
  //   transition: "none",
  //   maxToasts: 20,
  //   newestOnTop: true,
  // });
}

boot().then(() => {
  console.log("finished booting");
});
