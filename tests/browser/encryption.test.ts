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
import { forgetPassword, listFiles, setupFSStorage } from "./fs-utils";

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

  it("a note stored both plain and encrypted: neither copy is overwritten (U5)", async () => {
    await encryptAllNotes("goodpassword");
    // e.g. a sync tool restored the plain version of "a"
    await fsWriteTextFile(dh, "a.edna.txt", blockHdrMarkdown + "plain copy");
    await loadNoteNames();
    await encryptAllNotes("goodpassword");
    expect(await listFiles(dh)).toEqual(["__metadata.edna.json", "a-1.encr.edna.txt", "a.encr.edna.txt", "b.encr.edna.txt"]);
    expect(await loadNote("a")).toBe(content);
    expect(await loadNote("a-1")).toBe(blockHdrMarkdown + "plain copy");

    await fsWriteTextFile(dh, "b.edna.txt", blockHdrMarkdown + "plain b");
    await loadNoteNames();
    await decryptAllNotes();
    expect(await listFiles(dh)).toEqual(["__metadata.edna.json", "a-1.edna.txt", "a.edna.txt", "b-1.edna.txt", "b.edna.txt"]);
    expect(await loadNote("b")).toBe(blockHdrMarkdown + "plain b");
    expect(await loadNote("b-1")).toBe(content);
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

  it("a password remembered for another encrypted directory isn't used (U3)", async () => {
    const { dh, ui } = await setupFSStorage();
    const a = await dh.getDirectoryHandle("a", { create: true });
    const b = await dh.getDirectoryHandle("b", { create: true });
    setStorageFS(a);
    await loadNoteNames();
    await createNoteWithName("x", blockHdrMarkdown + "x");
    await encryptAllNotes("password-a");

    forgetPassword();
    setStorageFS(b);
    await loadNoteNames();
    await createNoteWithName("y", blockHdrMarkdown + "y");
    await encryptAllNotes("password-b");
    expect(localStorage.getItem("edna-password")).toBe("password-b");

    // back in a: the remembered password is b's, a new note must use a's key
    setStorageFS(a);
    await loadNoteNames();
    ui.passwords.push("password-a");
    await createNoteWithName("z", blockHdrMarkdown + "z");
    expect(ui.prompts.length).toBe(1);
    expect(localStorage.getItem("edna-password")).toBe("password-a");
    forgetPassword();
    ui.passwords.push("password-a");
    expect(await loadNote("z")).toBe(blockHdrMarkdown + "z");
    expect(await loadNote("x")).toBe(blockHdrMarkdown + "x");
  });

  it("a damaged encrypted note fails to load instead of asking for the password forever", async () => {
    const { dh, ui } = await setupFSStorage();
    await createNoteWithName("a", blockHdrMarkdown + "a");
    await encryptAllNotes("goodpassword");
    await fsWriteTextFile(dh, "zz.encr.edna.txt", "not encrypted");
    await loadNoteNames();
    await expect(loadNote("zz")).rejects.toThrow("can't decrypt");
    expect(ui.prompts.length).toBe(0);
  });
});
