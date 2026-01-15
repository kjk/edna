import "./main.css";
import "./markdown-anti-tailwind.css";
import "highlight.js/styles/github.css";
import "tippy.js/themes/light-border.css";
import "tippy.js/themes/light.css";
import { mount, MountOptions, unmount } from "svelte";
import { testAppendStore } from "./apppendstore.test";
import { appState } from "./appstate.svelte";
import App from "./components/App.svelte";
import { ofsDeleteFiles, ofsListFiles } from "./fs-ofs";
import { updateAfterNoteStateChange } from "./globals";
import { getLoggedUser } from "./login";
import { loadAppMetadata } from "./metadata";
import { maybeMigrateNotesLocalToBackend } from "./migrate-local-to-backend";
import { Note } from "./note";
import {
  createIfNotExists,
  isValidTab,
  kDailyJournalNoteName,
  kInboxNoteName,
  kScratchNoteName,
  reassignNoteShortcut,
} from "./notes";
import { getSettings, Settings } from "./settings.svelte";
import { openBackendStore, openLocalStore, storeDumpIndex } from "./store";
import { getInboxNote, getJournalNote, getWelcomeNote } from "./system-notes";
import { isDev, len } from "./util";

// window.onunhandledrejection = console.warn;

let appSvelte: Record<string, any>;

function resetApp() {
  console.log("unmounting app");
  unmount(appSvelte);
  console.log("clearing localStorage");
  localStorage.clear();
  ofsDeleteFiles().then(() => {
    console.log("reloading");
    window.location.reload();
  });
}

function setupWindowDebug() {
  if (!isDev) {
    return;
  }
  // for ad-hoc use by me during development and debugging
  globalThis.debug = {
    listBrowserStorage: ofsListFiles,
    deleteBrowserStorage: ofsDeleteFiles,
    resetApp: resetApp,
    dumpIndex: storeDumpIndex,
    testAppendStore: testAppendStore,
  };
}

async function createDefaultNotes(existingNotes: Note[]): Promise<string[]> {
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
    await reassignNoteShortcut(kScratchNoteName, "1");
    await reassignNoteShortcut(kDailyJournalNoteName, "2");
    await reassignNoteShortcut(kInboxNoteName, "3");
  }
  return createdNotes;
}

export async function boot() {
  console.log("booting");

  setupWindowDebug();
  // await testFuncs();

  if ("serviceWorker" in navigator) {
    if (!isDev()) {
      if (false) {
        navigator.serviceWorker.register("/sw.js");
      }
      if (false) {
        const svURL = new URL("./sw.js", import.meta.url);
        navigator.serviceWorker.register(svURL);
      }
    }
  }

  getSettings();
  let user = await getLoggedUser();
  console.log("user:", user);
  appState.user = user;
  let store;
  if (user) {
    await maybeMigrateNotesLocalToBackend();
    store = await openBackendStore();
  } else {
    store = await openLocalStore();
  }
  await loadAppMetadata(); // pre-load
  let allNotes = await store.getAllNotes();
  updateAfterNoteStateChange(allNotes);

  let createdNotes = await createDefaultNotes(allNotes);
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
  let nameFromSettings = settings.currentTab;

  // need to do this twice to make sure hashName takes precedence over settings.currentNoteName
  if (isValidTab(nameFromSettings)) {
    toOpenAtStartup = nameFromSettings;
    console.log(
      "will open note from settings.currentNoteName:",
      nameFromSettings,
    );
  }
  if (isValidTab(nameFromURLHash)) {
    toOpenAtStartup = nameFromURLHash;
    console.log("will open note from url #hash:", nameFromURLHash);
  }
  if (!isValidTab(nameFromSettings)) {
    toOpenAtStartup = kScratchNoteName;
  }

  // will open this note in Editor.vue on mounted()
  settings.currentTab = toOpenAtStartup;
  settings.addTab(toOpenAtStartup);

  // remove non-existing notes from tabs
  let nTabs = settings.tabs.length;
  for (let i = nTabs - 1; i >= 0; i--) {
    let tabStr = settings.tabs[i];
    if (!isValidTab(tabStr)) {
      console.warn(`removing tab ${tabStr} because no note of that name`);
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
  const opts: MountOptions = {
    target: document.getElementById("app") as Element,
  };
  appSvelte = mount(App, opts);
}

boot().then(() => {
  console.log("finished booting");
});
