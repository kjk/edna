import { beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { appState } from "../../src/appstate.svelte";
import { createNoteWithName, loadNote, saveNote } from "../../src/notes";
import { getSettings } from "../../src/settings.svelte";
import { kTabHome } from "../../src/constants";
import { editorElement, editorInput, editorText, mountApp, pressMod } from "./app-ui";

// Integration tests: boot the whole app (docs/state-machines.md M8 dialogs)

function altDigit(n: number) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: String(n),
      code: `Digit${n}`,
      keyCode: 48 + n,
      altKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("app", () => {
  beforeAll(async () => {
    // first run creates scratch (Alt+1), journal (Alt+2), inbox (Alt+3)
    await mountApp();
  });

  // open note selector and type text into its filter input
  async function typeInNoteSelector(text: string): Promise<HTMLInputElement> {
    appState.showingNoteSelector = true;
    await expect.poll(() => document.querySelector<HTMLInputElement>("form input")).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>("form input")!;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return input;
  }

  async function openWithShortcut(n: number, name: string) {
    altDigit(n);
    await expect.poll(() => appState.currentNoteName).toBe(name);
    await expect.poll(() => document.title).toBe(name);
  }

  async function openFixture(name: string, content: string, visibleText: string) {
    await createNoteWithName(name, content);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: name } }));
    await expect.poll(() => document.title).toBe(name);
    await expect.poll(editorText).toContain(visibleText);
    editorInput().focus();
  }

  async function appendText(text: string) {
    editorInput().focus();
    await pressMod("End");
    await userEvent.keyboard(text);
  }

  it("Alt+N opens a note when no dialog is open", async () => {
    await openWithShortcut(1, "scratch");
    await openWithShortcut(3, "inbox");
  });

  it("Alt+N doesn't switch notes while a dialog is open", async () => {
    await openWithShortcut(1, "scratch");
    appState.showingRenameNote = true;
    altDigit(3);
    await new Promise((r) => setTimeout(r, 100));
    expect(appState.currentNoteName).toBe("scratch");
    appState.showingRenameNote = false;
  });

  it("browser Back closes dialogs before switching notes", async () => {
    await openWithShortcut(1, "scratch");
    await openWithShortcut(3, "inbox");
    appState.showingRenameNote = true;
    window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: "scratch" } }));
    expect(appState.showingRenameNote).toBe(false);
    await expect.poll(() => appState.currentNoteName).toBe("scratch");
  });

  it("switching from note selector to command palette resets 'open in new tab'", async () => {
    await openWithShortcut(1, "scratch");
    appState.forceNewTab = true;
    await typeInNoteSelector(">");
    await expect.poll(() => appState.showingCommandPalette).toBe(true);
    expect(appState.forceNewTab).toBe(false);
    appState.showingCommandPalette = false;
  });

  it("output of a run goes to the note it was started in", async () => {
    const code = "new Promise((resolve) => setTimeout(() => resolve('run-output-' + 6 * 7), 500))";
    await openFixture("run-source", "\n∞∞∞javascript\n" + code, "run-output-");
    await pressMod("End");
    await pressMod("e");
    // switch notes while the code runs
    await openWithShortcut(3, "inbox");
    await expect.poll(async () => await loadNote("run-source"), { timeout: 3000 }).toContain("run-output-42");
    expect(await loadNote("inbox")).not.toContain("run-output-42");
  });

  it("opening a 'find in notes' result moves the cursor to the match", async () => {
    await openWithShortcut(1, "scratch");
    const word = "find-in-notes-target";
    const inbox = (await loadNote("inbox"))!;
    await saveNote("inbox", inbox + "\nsome text " + word + "\n");

    appState.showingFindInNotes = true;
    await expect.poll(() => document.querySelector<HTMLInputElement>("input[placeholder^=\x27Find in notes\x27]")).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>("input[placeholder^=\x27Find in notes\x27]")!;
    input.value = word;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const enter = () =>
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    enter();
    await expect.poll(() => document.querySelector(".dlg-colors")?.textContent ?? "").toContain(word);
    enter();
    await expect.poll(() => appState.currentNoteName).toBe("inbox");
    await expect.poll(editorText).toContain(word);
    await expect.poll(() => document.activeElement).toBe(editorInput());
    await userEvent.keyboard("here:");
    await pressMod("s");
    await expect.poll(() => loadNote("inbox")).toContain("some text here:" + word);
  });

  it("starting a new 'find in notes' search stops the previous one", async () => {
    await openWithShortcut(1, "scratch");
    for (const name of ["inbox", "scratch", "daily journal"]) {
      const c = (await loadNote(name)) ?? "";
      await saveNote(name, c + "\nfirst-search-term second-search-term-" + name + "\n");
    }
    await saveNote("inbox", ((await loadNote("inbox")) ?? "") + "\nonly-first-search-term\n");

    appState.showingFindInNotes = true;
    const sel = "input[placeholder^='Find in notes']";
    await expect.poll(() => document.querySelector<HTMLInputElement>(sel)).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>(sel)!;
    const search = (term: string) => {
      input.value = term;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    };
    search("first-search-term");
    search("second-search-term");
    const dlg = () => document.querySelector(".dlg-colors")?.textContent ?? "";
    await expect.poll(dlg).toContain("second-search-term-inbox");
    await new Promise((r) => setTimeout(r, 200));
    expect(dlg()).not.toContain("only-first-search-term");
    expect(dlg()).not.toContain("No results");
    appState.showingFindInNotes = false;
  });

  it("renaming a note with pending edits doesn't re-create the old note", async () => {
    await openWithShortcut(3, "inbox");
    await appendText("{Enter}edit-before-rename");
    appState.showingRenameNote = true;
    await expect.poll(() => document.querySelector<HTMLInputElement>(".dlg input, form input")).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>(".dlg input, form input")!;
    input.value = "inbox-renamed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await expect.poll(() => appState.currentNoteName).toBe("inbox-renamed");
    // wait for the auto-save delay
    await new Promise((r) => setTimeout(r, 2500));
    expect(appState.allNotes).not.toContain("inbox");
    expect(await loadNote("inbox-renamed")).toContain("edit-before-rename");
  }, 10000);

  it("switching notes quickly ends on the last requested note", async () => {
    await openWithShortcut(2, "daily journal");
    // move the cursor so that switching away saves the selection (slower path)
    editorInput().focus();
    await pressMod("End");
    altDigit(3);
    altDigit(1);
    await new Promise((r) => setTimeout(r, 500));
    expect(appState.currentNoteName).toBe("scratch");
    expect(document.title).toBe("scratch");
  });

  it("Home tab updates the URL; Back returns to the note; Back/Forward doesn't add tabs", async () => {
    await openWithShortcut(1, "scratch");
    expect(location.hash).toBe("#scratch");
    const settings = getSettings();
    settings.currentTab = kTabHome;
    await expect.poll(() => location.hash).toBe("");
    expect(history.state?.noteName).toBe(kTabHome);

    // Back from Home to the note
    window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: "scratch" } }));
    await expect.poll(() => appState.currentNoteName).toBe("scratch");

    // Back to Home entry
    window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: kTabHome } }));
    await expect.poll(() => settings.currentTab).toBe(kTabHome);

    await openWithShortcut(1, "scratch");
    const nTabs = settings.tabs.length;
    window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: "daily journal" } }));
    await expect.poll(() => appState.currentNoteName).toBe("daily journal");
    expect(settings.tabs.length).toBe(nTabs);
  });

  it("note changed in another tab: reloaded on focus if no edits, else edits saved as a copy", async () => {
    await openWithShortcut(1, "scratch");
    // another tab changes the note; we have no edits
    localStorage.setItem("note:scratch", "\n\u221E\u221E\u221Emarkdown\nchanged in other tab\n");
    window.dispatchEvent(new Event("focus"));
    await expect.poll(editorText).toContain("changed in other tab");

    // another tab changes it again while we have edits
    await appendText("my edit");
    localStorage.setItem("note:scratch", "\n\u221E\u221E\u221Emarkdown\nsecond change in other tab\n");
    await pressMod("s");
    await expect.poll(() => appState.currentNoteName).toBe("scratch-conflict");
    expect(await loadNote("scratch")).toContain("second change in other tab");
    expect(await loadNote("scratch-conflict")).toContain("my edit");
  });
  function openContextMenu() {
    const target = editorElement() || document.querySelector("#app > div") || document.body;
    target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
  }
  function menuText(): string {
    return document.querySelector('[role="menu"]')?.textContent || "";
  }

  it("Home tab context menu has the storage, encryption and help submenus (U15)", async () => {
    await openWithShortcut(1, "scratch");
    getSettings().currentTab = kTabHome;
    await expect.poll(editorElement).toBeNull();
    openContextMenu();
    await expect.poll(() => menuText()).toContain("Notes storage");
    expect(menuText()).toContain("Help");
    appState.showingContextMenu = false;
  });

  it("context menu works in a block with an unknown language (U12)", async () => {
    await openFixture("unknown-language", "\n∞∞∞foo\nunknown block content", "unknown block content");
    await pressMod("End");
    openContextMenu();
    await expect.poll(() => appState.showingContextMenu).toBe(true);
    await expect.poll(() => menuText()).not.toBe("");
    appState.showingContextMenu = false;
  });

  it("command palette has no duplicate commands (U25)", async () => {
    await openWithShortcut(1, "scratch");
    const errors: string[] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.join(" "));
      orig(...args);
    };
    try {
      appState.showingCommandPalette = true;
      await expect.poll(() => document.querySelectorAll('[role="listbox"] [role="option"], .listbox-item, li').length).toBeGreaterThan(5);
      expect(errors.filter((e) => e.includes("duplicate command id"))).toEqual([]);
    } finally {
      console.error = orig;
      appState.showingCommandPalette = false;
    }
  });

  it("deleting the current note when switching to scratch fails keeps the note (U19)", async () => {
    const { loadNoteNames } = await import("../../src/notes");
    await createNoteWithName("todel", "\n\u221E\u221E\u221Emarkdown\nkeep me\n");
    window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: "todel" } }));
    await expect.poll(() => appState.currentNoteName).toBe("todel");

    // make loading scratch fail: it's gone from storage
    const scratch = localStorage.getItem("note:scratch")!;
    localStorage.removeItem("note:scratch");
    await loadNoteNames();
    try {
      const input = await typeInNoteSelector("todel");
      await new Promise((r) => setTimeout(r, 50));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 300));
      expect(await loadNote("todel")).toContain("keep me");
      expect(appState.currentNoteName).toBe("todel");
    } finally {
      appState.showingNoteSelector = false;
      localStorage.setItem("note:scratch", scratch);
      await loadNoteNames();
    }
  });
});
