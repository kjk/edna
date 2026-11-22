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
  getSettings();
  setStorageFS(dh);
  await upgradeMetadata();
  await loadNotesMetadata();
  await loadNoteNames();
  return { dh, ui };
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
