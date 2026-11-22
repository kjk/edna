import { beforeEach, describe, expect, it } from "vitest";
import { appState } from "../../src/appstate.svelte";
import { blockHdrMarkdown } from "../../src/constants";
import { loadNotesMetadata, upgradeMetadata } from "../../src/metadata";
import {
  appendToNote,
  createNoteWithName,
  loadNote,
  loadNoteNames,
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
});
