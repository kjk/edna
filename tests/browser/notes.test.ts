import { beforeEach, describe, expect, it } from "vitest";
import { appState } from "../../src/appstate.svelte";
import { blockHdrMarkdown } from "../../src/constants";
import { getNoteMeta, getNotesMetadata, loadNotesMetadata, toggleNoteStarred, upgradeMetadata } from "../../src/metadata";
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
} from "../../src/notes";
import { getSettings } from "../../src/settings.svelte";

// note lifecycle in localStorage (docs/state-machines.md M4, issue 3)
describe("notes (localStorage)", () => {
  beforeEach(async () => {
    localStorage.clear();
    getSettings();
    await upgradeMetadata();
    await loadNotesMetadata();
    await loadNoteNames();
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
    const root = await navigator.storage.getDirectory();
    const fh = await root.getFileHandle("Foo.edna.txt", { create: true });
    expect(rememberOpenedNote(fh)).toBe("Foo-1");
    expect(appState.allNotes).toContain("Foo-1");
    await dbDelDirHandle();
    await loadNoteNames();
    expect(appState.allNotes).toEqual(["foo"]);
    await root.removeEntry("Foo.edna.txt");
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
});
