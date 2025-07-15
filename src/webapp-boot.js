import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import { mount, unmount } from "svelte";
import { dumpIndex } from "./appendstore";
import { appState, findNoteByName } from "./appstate.svelte";
import App from "./components/App.svelte";
import { updateAfterNoteStateChange } from "./globals";
import { getLoggedUser } from "./login";
import { loadAppMetadata } from "./metadata";
import {
  deleteBrowserStorage,
  maybeMigrateNotesLocalToBackend,
} from "./migrate-local-to-backend";
import { Note } from "./note";
import {
  createIfNotExists,
  isSystemNoteName,
  kDailyJournalNoteName,
  kInboxNoteName,
  kScratchNoteName,
  reassignNoteShortcut,
} from "./notes";
import { getSettings } from "./settings.svelte";
import { openBackendStore, openLocalStore } from "./store";
import { getInboxNote, getJournalNote, getWelcomeNote } from "./system-notes";
import { isDev, len } from "./util";

/** @typedef {import("./settings.svelte").Settings} Settings */

// window.onunhandledrejection = console.warn;

let appSvelte;

function resetApp() {
  console.log("unmounting app");
  unmount(appSvelte);
  console.log("clearing localStorage");
  localStorage.clear();
  deleteBrowserStorage().then(() => {
    console.log("reloading");
    window.location.reload();
  });
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
    dumpIndex: dumpIndex,
  };
}

/**
 * @param {Note[]} existingNotes
 * @returns {Promise<string[]>}
 */
async function createDefaultNotes(existingNotes) {
  let isFirstRun = len(existingNotes) == 0;
  console.log(
    `isFirstRun: ${isFirstRun}, len(existingNotes): ${len(existingNotes)}`,
  );

  let welcomeNote = getWelcomeNote();

  let createdNotes = [];

  let didCreate = await createIfNotExists(
    kScratchNoteName,
    welcomeNote,
    existingNotes,
  );
  if (didCreate) {
    createdNotes.push(kScratchNoteName);
  }

  // scratch note must always exist but the user can delete inbox / daily journal notes
  if (isFirstRun) {
    let inbox = getInboxNote();
    didCreate = await createIfNotExists(kInboxNoteName, inbox, existingNotes);
    if (didCreate) {
      createdNotes.push(kInboxNoteName);
    }
    // re-create those notes if the user hasn't deleted them
    let journal = getJournalNote();
    didCreate = await createIfNotExists(
      kDailyJournalNoteName,
      journal,
      existingNotes,
    );
    if (didCreate) {
      createdNotes.push(kDailyJournalNoteName);
    }
  }
  if (isFirstRun) {
    reassignNoteShortcut(kScratchNoteName, "1");
    reassignNoteShortcut(kDailyJournalNoteName, "2");
    reassignNoteShortcut(kInboxNoteName, "3");
  }
  return createdNotes;
}

export async function boot() {
  console.log("booting");
  setupWindowDebug();
  // await testFuncs();

  getSettings();
  let user = await getLoggedUser();
  console.log("user:", user);
  appState.user = user;
  if (user) {
    await maybeMigrateNotesLocalToBackend();
    appState.allNotes = await openBackendStore();
  } else {
    appState.allNotes = await openLocalStore();
  }
  updateAfterNoteStateChange();
  await loadAppMetadata(); // pre-load

  let createdNotes = await createDefaultNotes(appState.allNotes);
  console.log("createdNotes:", createdNotes);
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

  // if newly created notes, add them to the tabs
  for (let noteName of createdNotes) {
    settings.addTab(noteName);
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
