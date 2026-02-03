import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import { mount, unmount } from "svelte";
import posthog from "posthog-js";
import App from "./components/App.svelte";
import AskFSPermissions from "./components/AskFSPermissions.svelte";
import { hasHandlePermission } from "./fileutil";
import { loadNotesMetadata, upgradeMetadata } from "./metadata";
import {
  createDefaultNotes,
  dbGetDirHandle,
  ensureValidNoteNamesFS,
  isSystemNoteName,
  kScratchNoteName,
  loadNoteNames,
  preLoadAllNotes,
  setStorageFS,
} from "./notes";
import { getSettings } from "./settings.svelte";
import { isDev } from "./util";

/** @typedef {import("./settings.svelte").Settings} Settings */

// window.onunhandledrejection = console.warn;

let appSvelte;

function setupPosthog() {
  if (isDev()) {
    return;
  }

  posthog.init("phc_8aJPkRJ48D27YvIX4irWubORzvFA28CoI8Y2Es9JLNw", {
    //api_host: "https://us.i.posthog.com",
    api_host: "https://ph.arslexis.io",
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only", // or 'always' to create profiles for anonymous users as well
  });

  const originalConsoleError = console.error;
  /**
   * @param  {...any} args
   */
  function myConsoleError(...args) {
    originalConsoleError.apply(console, args);

    let err;
    if (args.length === 1 && args[0] instanceof Error) {
      err = args[0];
    } else {
      let msg = args.join(" ");
      err = new Error("console.error: " + msg);
    }
    posthog.captureException(err);
  }
  console.error = myConsoleError;
}

export async function boot() {
  console.log("booting");

  setupPosthog();

  getSettings();

  let dh = await dbGetDirHandle();
  if (dh) {
    console.log("storing data in the file system");
    let ok = await hasHandlePermission(dh, true);
    if (!ok) {
      console.log("no permission to write files in directory", dh.name);
      setStorageFS(null);
      const args = {
        target: document.getElementById("app"),
      };
      appSvelte = mount(AskFSPermissions, args);
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

  // pick the note to open at startup:
  // - #${name} from the url
  // - settings.currentNoteName if it exists
  // - fallback to scratch note
  let toOpenAtStartup = kScratchNoteName; // default if nothing else matches
  let nameFromURLHash = window.location.hash.slice(1);
  nameFromURLHash = decodeURIComponent(nameFromURLHash);
  let nameFromSettings = settings.currentNoteName;

  // re-do because could have created default notes
  if (nCreated > 0) {
    noteNames = await loadNoteNames();
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  function isValidNote(name) {
    if (!name) {
      return false;
    }
    return noteNames.includes(name) || isSystemNoteName(name);
  }

  // need to do this twice to make sure hashName takes precedence over settings.currentNoteName
  if (isValidNote(nameFromSettings)) {
    toOpenAtStartup = nameFromSettings;
    console.log("will open note from settings.currentNoteName:", nameFromSettings);
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
  preLoadAllNotes().then((n) => {
    console.log(`finished pre-loading ${n} notes`);
  });
});

if (isDev) {
  // @ts-ignore
  window.resetApp = function () {
    console.log("unmounting app");
    unmount(appSvelte);
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
