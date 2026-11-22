import { beforeEach, describe, expect, it } from "vitest";
import { blockHdrMarkdown } from "../../src/constants";
import { fsWriteTextFile } from "../../src/fileutil";
import {
  createNoteWithName,
  decryptAllNotes,
  encryptAllNotes,
  hasEncryptedNotes,
  hasUnencryptedNotes,
  loadNote,
  loadNoteNames,
  setStorageFS,
} from "../../src/notes";
import { listFiles, setupFSStorage } from "./fs-utils";

// workspace encryption (docs/state-machines.md M2, issue 6)
describe("encrypt / decrypt all notes", () => {
  let dh: FileSystemDirectoryHandle;
  const content = blockHdrMarkdown + "secret";

  beforeEach(async () => {
    ({ dh } = await setupFSStorage());
    await createNoteWithName("a", content);
    await createNoteWithName("b", content);
  });

  it("can't run two storage operations at once", async () => {
    const p1 = encryptAllNotes("goodpassword");
    await expect(encryptAllNotes("goodpassword")).rejects.toThrow("in progress");
    await expect(decryptAllNotes()).rejects.toThrow("in progress");
    await p1;
    expect(await listFiles(dh)).toEqual(["__metadata.edna.json", "a.encr.edna.txt", "b.encr.edna.txt"]);
  });

  it("an interrupted encryption can be finished, with the same password only", async () => {
    await encryptAllNotes("goodpassword");
    // simulate a note that wasn't encrypted because encryption was interrupted
    await fsWriteTextFile(dh, "c.edna.txt", content);
    await loadNoteNames();
    expect(hasEncryptedNotes()).toBe(true);
    expect(hasUnencryptedNotes()).toBe(true);

    await expect(encryptAllNotes("otherpassword")).rejects.toThrow("doesn't match");
    expect(localStorage.getItem("edna-password")).toBe("goodpassword");

    await encryptAllNotes("goodpassword");
    expect(hasUnencryptedNotes()).toBe(false);
    expect(await listFiles(dh)).toContain("c.encr.edna.txt");
    expect(await loadNote("c")).toBe(content);
  });

  it("decrypt all", async () => {
    await encryptAllNotes("goodpassword");
    await decryptAllNotes();
    expect(hasEncryptedNotes()).toBe(false);
    expect(await listFiles(dh)).toEqual(["__metadata.edna.json", "a.edna.txt", "b.edna.txt"]);
    expect(localStorage.getItem("edna-password")).toBeNull();
  });
});

describe("encryption is a property of the directory", () => {
  it("a password remembered for another directory doesn't encrypt new notes", async () => {
    const { dh } = await setupFSStorage();
    const a = await dh.getDirectoryHandle("a", { create: true });
    const b = await dh.getDirectoryHandle("b", { create: true });
    setStorageFS(a);
    await loadNoteNames();
    await createNoteWithName("x", blockHdrMarkdown + "x");
    await encryptAllNotes("goodpassword");
    expect(localStorage.getItem("edna-password")).toBe("goodpassword");

    setStorageFS(b);
    await loadNoteNames();
    await createNoteWithName("y", blockHdrMarkdown + "y");
    expect(await listFiles(b)).toEqual(["y.edna.txt"]);
  });
});
