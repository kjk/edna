import { beforeEach, describe, expect, it } from "vitest";
import { appState } from "../../src/appstate.svelte";
import { blockHdrMarkdown, kDailyJournalNoteName } from "../../src/constants";
import { fsFileHandleReadTextFile, fsFileHandleWrite } from "../../src/fileutil";
import {
  getNoteMeta,
  getNotesMetadata,
  noteHasDailyEntry,
  reassignNoteShortcut,
  setNoteArchived,
  setNoteDailyEntry,
  toggleNoteStarred,
} from "../../src/metadata";
import {
  appendToNote,
  createDefaultNotes,
  createNoteWithName,
  loadNote,
  dbDelDirHandle,
  loadNoteNames,
  rememberOpenedNote,
  renameNote,
  saveNote,
  setStorageFS,
} from "../../src/notes";
import { listFiles, setupFSStorage, setupLocalStorage, useStorage } from "./fs-utils";

// note lifecycle in localStorage (docs/state-machines.md M4, issue 3)
// runs fn with a file named name in the origin private file system, then removes it
async function withTempFile(name: string, fn: (fh: FileSystemFileHandle) => Promise<void>) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(name, { create: true });
  try {
    await fn(fh);
  } finally {
    await root.removeEntry(name);
  }
}

it.each(["browser", "directory"])("appending writes to a separately opened file with %s storage", async (storage) => {
  const { dh } = await setupFSStorage();
  if (storage === "browser") {
    await useStorage(undefined);
  }
  const external = await dh.getDirectoryHandle("external", { create: true });
  const file = await external.getFileHandle("outside.edna.txt", { create: true });
  try {
    const initial = blockHdrMarkdown + "first";
    const appended = blockHdrMarkdown + "second";
    await fsFileHandleWrite(file, initial);
    expect(rememberOpenedNote(file)).toBe("outside");

    await appendToNote("outside", appended);

    expect(await fsFileHandleReadTextFile(file)).toBe(initial + appended);
    expect(localStorage.getItem("note:outside")).toBeNull();
    expect(await listFiles(dh)).not.toContain("outside.edna.txt");
  } finally {
    await dbDelDirHandle();
    await dh.removeEntry("external", { recursive: true });
  }
});

it("retains both blocks when appends to a file overlap", async () => {
  await setupFSStorage();
  const initial = blockHdrMarkdown + "original";
  const first = blockHdrMarkdown + "first";
  const second = blockHdrMarkdown + "second";
  await createNoteWithName("appended", initial);
  await Promise.all([appendToNote("appended", first), appendToNote("appended", second)]);
  const saved = await loadNote("appended");
  expect([initial + first + second, initial + second + first]).toContain(saved);
});

it("checks for conflicts in the workspace where the save was queued", async () => {
  const { dh } = await setupFSStorage();
  const base = blockHdrMarkdown + "directory version";
  await createNoteWithName("same-name", base);
  localStorage.setItem("note:same-name", blockHdrMarkdown + "browser version");

  const saving = saveNote("same-name", base + " edited", base);
  setStorageFS(undefined);
  expect(await saving).toEqual({});
  expect(await loadNote("same-name")).toContain("browser version");

  await useStorage(dh);
  expect(await loadNote("same-name")).toBe(base + " edited");
  expect((await listFiles(dh)).filter((name) => name.endsWith(".edna.txt"))).toEqual(["same-name.edna.txt"]);
});

describe("notes (localStorage)", () => {
  beforeEach(async () => {
    await setupLocalStorage();
  });

  it("creating a note never overwrites an existing note, ignoring case", async () => {
    await createNoteWithName("Foo", blockHdrMarkdown + "important");
    await expect(createNoteWithName("Foo")).rejects.toThrow("already exists");
    await expect(createNoteWithName("foo")).rejects.toThrow("already exists");
    expect(await loadNote("Foo")).toContain("important");
    expect(appState.allNotes).toEqual(["Foo"]);
  });

  it("appending uses existing note that differs in case", async () => {
    await createNoteWithName("Foo", blockHdrMarkdown + "first");
    await appendToNote("FOO", blockHdrMarkdown + "second");
    expect(appState.allNotes).toEqual(["Foo"]);
    const s = await loadNote("Foo");
    expect(s).toContain("first");
    expect(s).toContain("second");
  });

  it("case-only rename", async () => {
    await createNoteWithName("Foo", blockHdrMarkdown + "content");
    await renameNote("Foo", "foo", blockHdrMarkdown + "content");
    expect(appState.allNotes).toEqual(["foo"]);
    expect(await loadNote("foo")).toContain("content");
  });

  it("saving doesn't overwrite a note changed elsewhere (e.g. another tab)", async () => {
    const a = blockHdrMarkdown + "version A";
    await createNoteWithName("x", a);
    // no change elsewhere: saved normally
    expect(await saveNote("x", a + " edited", a)).toEqual({});
    const mine = a + " edited";
    // another tab saves its version
    localStorage.setItem("note:x", blockHdrMarkdown + "other tab");
    const res = await saveNote("x", mine + " more", mine);
    expect(res.conflictName).toBe("x-conflict");
    expect(await loadNote("x")).toBe(blockHdrMarkdown + "other tab");
    expect(await loadNote("x-conflict")).toBe(mine + " more");
  });

  it("conflict copy and default notes: names unique ignoring case (U4)", async () => {
    const a = blockHdrMarkdown + "a";
    await createNoteWithName("x", a);
    await createNoteWithName("X-Conflict", blockHdrMarkdown + "older conflict");
    localStorage.setItem("note:x", blockHdrMarkdown + "other tab");
    const res = await saveNote("x", a + " mine", a);
    expect(res.conflictName).toBe("x-conflict-1");
    expect(await loadNote("X-Conflict")).toBe(blockHdrMarkdown + "older conflict");

    // "Scratch" created outside Edna: becomes "scratch" instead of failing boot
    localStorage.setItem("note:Scratch", blockHdrMarkdown + "my scratch");
    const names = await loadNoteNames();
    await createDefaultNotes(names);
    expect(appState.allNotes).toContain("scratch");
    expect(appState.allNotes).not.toContain("Scratch");
    expect(await loadNote("scratch")).toBe(blockHdrMarkdown + "my scratch");
    // not a new store: inbox / journal not created
    expect(appState.allNotes).not.toContain("inbox");
  });

  it("notes opened from disk: unique ignoring case, forgotten when storage changes (U4, U6)", async () => {
    await createNoteWithName("foo", blockHdrMarkdown + "browser foo");
    await withTempFile("Foo.edna.txt", async (fh) => {
      expect(rememberOpenedNote(fh)).toBe("Foo-1");
      expect(appState.allNotes).toContain("Foo-1");
      await dbDelDirHandle();
      await loadNoteNames();
      expect(appState.allNotes).toEqual(["foo"]);
    });
  });

  it("a new note doesn't inherit metadata of a deleted note with that name (U7)", async () => {
    await createNoteWithName("old", blockHdrMarkdown + "old");
    await toggleNoteStarred("old");
    expect(getNoteMeta("old")?.isStarred).toBe(true);
    // deleted outside of Edna (e.g. another tab, or the file was removed)
    localStorage.removeItem("note:old");
    await loadNoteNames();
    await createNoteWithName("old", blockHdrMarkdown + "new");
    expect(getNoteMeta("old")?.isStarred).toBeFalsy();

    await createNoteWithName("a", blockHdrMarkdown + "a");
    await toggleNoteStarred("a");
    await createNoteWithName("b", blockHdrMarkdown + "b");
    // stale entry for "c"
    getNoteMeta("c", true)!.isArchived = true;
    await renameNote("b", "c", blockHdrMarkdown + "b");
    expect(getNoteMeta("c")?.isArchived).toBeFalsy();
    expect(getNotesMetadata().filter((m) => m.name === "c").length).toBeLessThanOrEqual(1);
  });

  it("note lists follow metadata updates", async () => {
    await createNoteWithName("note");
    expect(appState.regularNotes).toEqual(["note"]);
    expect(appState.archivedNotes).toEqual([]);
    expect(appState.starredNotes).toEqual([]);
    expect(appState.withShortcuts).toEqual([]);

    await setNoteArchived("note", true);
    await toggleNoteStarred("note");
    await reassignNoteShortcut("note", "1");

    expect(appState.regularNotes).toEqual([]);
    expect(appState.archivedNotes).toEqual(["note"]);
    expect(appState.starredNotes).toEqual(["note"]);
    expect(appState.withShortcuts).toEqual(["note"]);
  });

  it("daily entry: on by default for daily journal only, kept after rename (#25)", async () => {
    await createNoteWithName(kDailyJournalNoteName, blockHdrMarkdown + "j");
    await createNoteWithName("log", blockHdrMarkdown + "l");
    expect(noteHasDailyEntry(kDailyJournalNoteName)).toBe(true);
    expect(noteHasDailyEntry("log")).toBe(false);

    await renameNote(kDailyJournalNoteName, "my journal", blockHdrMarkdown + "j");
    expect(noteHasDailyEntry("my journal")).toBe(true);

    await setNoteDailyEntry("log", true);
    await renameNote("log", "work log", blockHdrMarkdown + "l");
    expect(noteHasDailyEntry("work log")).toBe(true);

    await setNoteDailyEntry("work log", false);
    await renameNote("work log", kDailyJournalNoteName, blockHdrMarkdown + "l");
    expect(noteHasDailyEntry(kDailyJournalNoteName)).toBe(false);
  });

  it("opening a file that isn't a .edna.txt note is refused, not a crash", async () => {
    await withTempFile("notes.txt", async (fh) => {
      expect(rememberOpenedNote(fh)).toBeNull();
    });
  });
});
