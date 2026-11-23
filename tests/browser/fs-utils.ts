import { setGlobalFuncs } from "../../src/globals";
import { loadNotesMetadata, upgradeMetadata } from "../../src/metadata";
import { loadNoteNames, setStorageFS } from "../../src/notes";
import { getSettings } from "../../src/settings.svelte";

// Test helpers for notes stored in a directory: uses Origin Private File System
// as the notes directory.

export interface FakeUI {
  passwords: string[]; // answers to password prompts ("" = cancel)
  prompts: string[]; // messages of password prompts
}

export async function setupFSStorage(): Promise<{ dh: FileSystemDirectoryHandle; ui: FakeUI }> {
  localStorage.clear();
  const dh = await navigator.storage.getDirectory();
  // @ts-ignore
  for await (const name of dh.keys()) {
    await dh.removeEntry(name, { recursive: true });
  }
  const ui: FakeUI = { passwords: [], prompts: [] };
  setGlobalFuncs({
    focusEditor: () => {},
    updateAfterNoteStateChange: () => {},
    requestFileWritePermission: async () => true,
    getPasswordFromUser: async (msg: string) => {
      ui.prompts.push(msg);
      return ui.passwords.shift() ?? "";
    },
  });
  await startWithStorage(dh);
  return { dh, ui };
}

// loads settings and switches to storage dh (undefined: localStorage), as when booting
async function startWithStorage(dh: FileSystemDirectoryHandle | undefined) {
  getSettings();
  setStorageFS(dh);
  await loadStorageState();
}

// empty localStorage storage, loaded
export async function setupLocalStorage() {
  localStorage.clear();
  await startWithStorage(undefined);
}

// switches storage to directory dh (undefined: localStorage) and loads its note names
export async function useStorage(dh: FileSystemDirectoryHandle | undefined) {
  setStorageFS(dh);
  await loadNoteNames();
}

// loads metadata and note names of the current storage, as the app does when booting
export async function loadStorageState() {
  await upgradeMetadata();
  await loadNotesMetadata();
  await loadNoteNames();
}

export async function listFiles(dh: FileSystemDirectoryHandle): Promise<string[]> {
  const res: string[] = [];
  // @ts-ignore
  for await (const name of dh.keys()) {
    res.push(name);
  }
  return res.sort();
}

// forget remembered password, as if notes were opened in a new browser
export function forgetPassword() {
  localStorage.removeItem("edna-password");
}
