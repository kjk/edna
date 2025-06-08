import "./main.css";

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
import { loadNotesMetadata, upgradeMetadata } from "./metadata";
import {
  getSettings,
  loadInitialSettings,
  setSetting,
} from "./settings.svelte";
import { isDev } from "./util";
import { mount, unmount } from "svelte";

import App from "./components/App.svelte";
import AskFSPermissions from "./components/AskFSPermissions.svelte";
import { hasHandlePermission } from "./fileutil";

/** @typedef {import("./settings.svelte").Settings} Settings */

// window.onunhandledrejection = console.warn;

let appSvelte;

export async function boot() {
  console.log("booting");

  // await testFuncs();

  loadInitialSettings();

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
  setSetting("currentNoteName", toOpenAtStartup);
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
