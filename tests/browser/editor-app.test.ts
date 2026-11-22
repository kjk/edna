import { beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { loadNote } from "../../src/notes";
import { editorInput, editorText, mountApp, openNoteShortcut, pressMod } from "./app-ui";

describe("editor in the app", () => {
  beforeAll(async () => {
    await mountApp({
      scratch: "\n∞∞∞text\nfirst note text",
      inbox: "\n∞∞∞text\nsecond note text",
      "daily journal": "\n∞∞∞javascript\ncall",
      "editor tasks": "\n∞∞∞markdown\n- [ ] send proposal\n\n∞∞∞text\nclipboard end",
    });
  });

  it("saves pending edits on a note switch and restores the caret when returning", async () => {
    await openNoteShortcut(1, "scratch");
    await expect.poll(editorText).toContain("first note text");
    await pressMod("End");
    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}!");

    await openNoteShortcut(3, "inbox");
    await expect.poll(editorText).toContain("second note text");
    expect(await loadNote("scratch")).toBe("\n∞∞∞text\nfirst note te!xt");
    await pressMod("End");
    await userEvent.keyboard("?");

    await openNoteShortcut(1, "scratch");
    await expect.poll(editorText).toContain("first note te!xt");
    expect(await loadNote("inbox")).toBe("\n∞∞∞text\nsecond note text?");
    await userEvent.keyboard("+");
    await pressMod("s");
    await expect.poll(() => loadNote("scratch")).toBe("\n∞∞∞text\nfirst note te!+xt");
  });

  it("applies gutter and bracket settings to the open note", async () => {
    await openNoteShortcut(2, "daily journal");
    await expect.poll(editorText).toContain("call");
    const lineNumbers = () => document.querySelector("#app .cm-lineNumbers");
    await expect.poll(lineNumbers).not.toBeNull();
    await pressMod("End");
    await userEvent.keyboard("(");
    await expect.poll(editorText).toContain("call()");
    await userEvent.keyboard("{Backspace}");

    await pressMod("k", true);
    await page.getByRole("option", { name: "Settings", exact: true }).click();
    const showLineNumbers = page.getByRole("checkbox", { name: "Show line numbers" });
    const autoClose = page.getByRole("checkbox", { name: "Auto-close brackets and quotation marks" });
    await expect.element(showLineNumbers).toBeChecked();
    await expect.element(autoClose).toBeChecked();
    (showLineNumbers.element() as HTMLInputElement).click();
    await expect.element(showLineNumbers).not.toBeChecked();
    (autoClose.element() as HTMLInputElement).click();
    await expect.element(autoClose).not.toBeChecked();
    await userEvent.keyboard("{Escape}");

    await expect.element(showLineNumbers).not.toBeInTheDocument();
    await expect.poll(lineNumbers).toBeNull();
    await expect.poll(() => document.activeElement).toBe(editorInput());
    await pressMod("End");
    await userEvent.keyboard("(");
    await pressMod("s");
    await expect.poll(() => loadNote("daily journal")).toMatch(/\n∞∞∞javascript\ncall\($/);
  });

  it("runs the checkbox command and strips block delimiters on copy and paste", async () => {
    await pressMod("k");
    const selectorInput = () => document.querySelector<HTMLInputElement>("form input[type=text]");
    await expect.poll(selectorInput).not.toBeNull();
    selectorInput()!.focus();
    await userEvent.keyboard("editor tasks");
    await page.getByRole("option", { name: "editor tasks" }).click();
    await expect.poll(() => document.title).toBe("editor tasks");
    const checkbox = () => editorInput().querySelector<HTMLInputElement>("input[type=checkbox]");
    await expect.poll(() => checkbox()?.checked).toBe(false);
    await userEvent.click(checkbox()!);
    await expect.poll(() => checkbox()?.checked).toBe(true);

    editorInput().focus();
    await pressMod("s");
    await expect.poll(() => loadNote("editor tasks")).toContain("- [x] send proposal");
    await pressMod("Home");
    await pressMod("k", true);
    await page.getByRole("option", { name: /Edit: Toggle todo checkbox/ }).click();
    await pressMod("s");
    await expect.poll(() => loadNote("editor tasks")).toContain("- [ ] send proposal");

    await pressMod("Home");
    await pressMod("End", true);
    const copiedData = new DataTransfer();
    editorInput().dispatchEvent(new ClipboardEvent("copy", { clipboardData: copiedData, bubbles: true, cancelable: true }));
    expect(copiedData.getData("text/plain")).toBe("- [ ] send proposal\n\n\nclipboard end");

    await pressMod("End");
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "\n∞∞∞javascript\npasted text");
    editorInput().dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
    await expect.poll(editorText).toContain("pasted text");
    await pressMod("s");
    await expect
      .poll(() => loadNote("editor tasks"))
      .toBe("\n∞∞∞markdown\n- [ ] send proposal\n\n∞∞∞text\nclipboard end\n\npasted text");
  });
});
