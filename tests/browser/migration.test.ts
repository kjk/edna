import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { appState } from "../../src/appstate.svelte";
import { blockHdrMarkdown } from "../../src/constants";
import { fsReadTextFile, fsWriteFile } from "../../src/fileutil";
import { getNoteMeta, kMetadataName, toggleNoteStarred } from "../../src/metadata";
import {
  appendToNote,
  createNoteWithName,
  dbDelDirHandle,
  encryptAllNotes,
  getStorageFS,
  loadNote,
  loadNoteNames,
  switchToStoringNotesOnDisk,
} from "../../src/notes";
import { forgetPassword, listFiles, setupFSStorage, setupLocalStorage, useStorage, type FakeUI } from "./fs-utils";

const note = (s: string) => blockHdrMarkdown + s;

// moving notes from localStorage to a directory (docs/state-machines.md M1, issue 7)
describe("move notes to directory", () => {
  let dh: FileSystemDirectoryHandle;
  let ui: FakeUI;

  // directory notes: written to dh; localStorage notes: created in LS mode
  async function setup(dirNotes: Record<string, string>, lsNotes: Record<string, string>) {
    ({ dh, ui } = await setupFSStorage());
    for (let [name, content] of Object.entries(dirNotes)) {
      await fsWriteFile(dh, name + ".edna.txt", content);
    }
    await setupLocalStorage();
    for (let [name, content] of Object.entries(lsNotes)) {
      await createNoteWithName(name, content);
    }
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(async () => {
    // switchToStoringNotesOnDisk() remembers the directory
    await dbDelDirHandle();
    localStorage.clear();
  });

  it("a browser note with an invalid name is renamed (U2)", async () => {
    await setup({}, { a: note("a") });
    // created before names were validated
    localStorage.setItem("note:b.encr", note("b.encr"));
    await loadNoteNames();
    const renamed = await switchToStoringNotesOnDisk(dh);
    expect(renamed.get("b.encr")).toBe("b.encr-1");
    expect(await listFiles(dh)).not.toContain("b.encr.edna.txt");
    expect(await loadNote("b.encr-1")).toBe(note("b.encr"));
    expect(await loadNote("a")).toBe(note("a"));
  });

  it("invalid note names are refused (U2)", async () => {
    await setup({}, {});
    await useStorage(dh);
    await expect(createNoteWithName("x.encr", note("x"))).rejects.toThrow("invalid note name");
    await expect(createNoteWithName("system:help", note("x"))).rejects.toThrow("invalid note name");
    await expect(appendToNote("system:help", note("x"))).rejects.toThrow("invalid note name");
    const files = await listFiles(dh);
    expect(files.filter((f) => f.startsWith("x.encr") || f.startsWith("system"))).toEqual([]);
  });

  it("browser notes differing only in case don't overwrite each other (U4)", async () => {
    await setup({}, { foo: note("ls foo") });
    // localStorage keys are case-sensitive: created by an old version or another tab
    localStorage.setItem("note:Foo", note("ls Foo"));
    await loadNoteNames();
    const renamed = await switchToStoringNotesOnDisk(dh);
    const files = await listFiles(dh);
    const newName = renamed.get("Foo") ?? renamed.get("foo");
    expect(newName).toBeDefined();
    expect(files.filter((f) => f.endsWith(".edna.txt")).length).toBe(2);
    const contents = [await loadNote("foo"), await loadNote(newName!)].sort();
    expect(contents).toEqual([note("ls Foo"), note("ls foo")]);
  });

  it("can't run twice at the same time", async () => {
    await setup({}, { a: note("a") });
    const p = switchToStoringNotesOnDisk(dh);
    await expect(switchToStoringNotesOnDisk(dh)).rejects.toThrow("in progress");
    await p;
    expect(await loadNote("a")).toBe(note("a"));
  });

  it("name collisions don't overwrite notes", async () => {
    await setup({ foo: note("disk foo") }, { foo: note("ls foo"), "foo-1": note("ls foo-1"), Bar: note("ls Bar") });
    await fsWriteFile(dh, "bar.edna.txt", note("disk bar"));
    const renamed = await switchToStoringNotesOnDisk(dh);
    expect(getStorageFS()).toBe(dh);
    const contents = new Set<string>();
    for (const name of appState.allNotes) {
      contents.add((await loadNote(name))!);
    }
    for (const c of ["disk foo", "ls foo", "ls foo-1", "ls Bar", "disk bar"]) {
      expect(contents).toContain(note(c));
    }
    expect(renamed.get("foo")).toBe("foo-2");
    // case-insensitive file systems: Bar must not overwrite bar
    expect(renamed.get("Bar")).toBe("Bar-1");
    // localStorage notes were removed
    expect(Object.keys(localStorage).filter((k) => k.startsWith("note:"))).toEqual([]);
  });

  it("notes moved to a directory with encrypted notes are encrypted", async () => {
    ({ dh, ui } = await setupFSStorage());
    await createNoteWithName("s", note("secret"));
    await encryptAllNotes("goodpassword");
    forgetPassword();
    await useStorage(undefined);
    await createNoteWithName("a", note("a"));
    ui.passwords = ["goodpassword"];
    await switchToStoringNotesOnDisk(dh);
    expect(await listFiles(dh)).toEqual([kMetadataName, "a.encr.edna.txt", "s.encr.edna.txt"]);
    expect(await loadNote("a")).toBe(note("a"));
  });

  it("corrupted metadata in localStorage doesn't lose notes; metadata is reloaded", async () => {
    await setup({ d: note("d") }, { a: note("a") });
    await fsWriteFile(dh, kMetadataName, JSON.stringify({ ver: 1, notes: [{ name: "d", isStarred: true }], functions: [] }));
    await toggleNoteStarred("a");
    await switchToStoringNotesOnDisk(dh);
    // in-memory metadata has both
    expect(getNoteMeta("a")?.isStarred).toBe(true);
    expect(getNoteMeta("d")?.isStarred).toBe(true);
    const onDisk = JSON.parse(await fsReadTextFile(dh, kMetadataName));
    expect(onDisk.notes.map((n: { name: string }) => n.name).sort()).toEqual(["a", "d"]);

    // now with corrupted localStorage metadata
    await setup({}, { b: note("b") });
    localStorage.setItem(kMetadataName, "{not json");
    await switchToStoringNotesOnDisk(dh);
    expect(await loadNote("b")).toBe(note("b"));
  });
});
