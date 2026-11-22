import { beforeAll, describe, expect, it } from "vitest";
import { appState } from "../../src/appstate.svelte";
import { dbDelDirHandle } from "../../src/notes";

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
    localStorage.clear();
    // other tests might have stored a notes directory
    await dbDelDirHandle();
    const div = document.createElement("div");
    div.id = "app";
    document.body.appendChild(div);
    await import("../../src/main");
    // first run creates scratch (Alt+1), journal (Alt+2), inbox (Alt+3)
    for (let i = 0; i < 100 && appState.allNotes.length < 3; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
  });

  async function openWithShortcut(n: number, name: string) {
    altDigit(n);
    await expect.poll(() => appState.currentNoteName).toBe(name);
    await expect.poll(() => document.title).toBe(name);
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
    appState.showingNoteSelector = true;
    await expect.poll(() => document.querySelector<HTMLInputElement>("form input")).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>("form input")!;
    input.value = ">";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await expect.poll(() => appState.showingCommandPalette).toBe(true);
    expect(appState.forceNewTab).toBe(false);
    appState.showingCommandPalette = false;
  });
});
