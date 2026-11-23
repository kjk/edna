import { beforeEach, describe, expect, it } from "vitest";
import { blockHdrMarkdown } from "../../src/constants";
import { createNoteWithName, encryptAllNotes, loadNote, saveNote } from "../../src/notes";
import { setGlobalFuncs } from "../../src/globals";
import { pressEnterIn, setInputValue, waitForInput } from "./app-ui";
import { forgetPassword, setupFSStorage, type FakeUI } from "./fs-utils";

// password state machine (docs/state-machines.md M3, issue 5)
describe("password", () => {
  let ui: FakeUI;
  const content = blockHdrMarkdown + "secret";

  beforeEach(async () => {
    ({ ui } = await setupFSStorage());
    await createNoteWithName("a", content);
    await createNoteWithName("b", content);
    await encryptAllNotes("goodpassword");
    forgetPassword();
  });

  it("cancelling the prompt fails the save and doesn't remember a password", async () => {
    ui.passwords = [""];
    await expect(saveNote("a", content + "2")).rejects.toThrow("password not provided");
    expect(localStorage.getItem("edna-password")).toBeNull();
    ui.passwords = ["goodpassword"];
    expect(await loadNote("a")).toBe(content);
  });

  it("a wrong password is rejected before it's used to encrypt", async () => {
    ui.passwords = ["typo-password", "goodpassword"];
    await saveNote("a", content + "2");
    expect(ui.prompts.length).toBe(2);
    expect(ui.prompts[1]).toContain("not correct");
    forgetPassword();
    ui.passwords = ["goodpassword"];
    expect(await loadNote("a")).toBe(content + "2");
  });

  it("concurrent requests share one password prompt", async () => {
    ui.passwords = ["goodpassword"];
    await Promise.all([saveNote("a", content + "a"), saveNote("b", content + "b")]);
    expect(ui.prompts.length).toBe(1);
  });

  it("cancelling while reading fails the load instead of looping", async () => {
    ui.passwords = [""];
    await expect(loadNote("a")).rejects.toThrow("password not provided");
  });

  it("password can be asked for when App is not mounted (e.g. while booting)", async () => {
    setGlobalFuncs(undefined);
    const p = loadNote("a");
    const input = await waitForInput("input[type=password]");
    setInputValue(input, "goodpassword");
    pressEnterIn(input);
    expect(await p).toBe(content);
    // dialog removed
    expect(document.querySelector("input[type=password]")).toBeNull();
  });
});
