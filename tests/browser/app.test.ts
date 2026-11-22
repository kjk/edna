import { beforeAll, describe, expect, it } from "vitest";
import { appState } from "../../src/appstate.svelte";
import { EditorView } from "@codemirror/view";
import { dbDelDirHandle, loadNote } from "../../src/notes";

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

  it("output of a run goes to the note it was started in", async () => {
    await openWithShortcut(1, "scratch");
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
    const code = "new Promise((resolve) => setTimeout(() => resolve('run-output-' + 6 * 7), 300))";
    const end = view.state.doc.length;
    view.dispatch({
      changes: { from: end, insert: "\n\u221E\u221E\u221Ejavascript\n" + code },
      selection: { anchor: end + "\n\u221E\u221E\u221Ejavascript\n".length + 2 },
    });
    const isMac = /Mac/.test(navigator.platform);
    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", { key: "e", code: "KeyE", keyCode: 69, metaKey: isMac, ctrlKey: !isMac, bubbles: true, cancelable: true }),
    );
    // switch notes while the code runs
    await openWithShortcut(3, "inbox");
    await expect.poll(async () => await loadNote("scratch"), { timeout: 3000 }).toContain("run-output-42");
    expect(await loadNote("inbox")).not.toContain("run-output-42");
  });

  it("opening a 'find in notes' result moves the cursor to the match", async () => {
    await openWithShortcut(1, "scratch");
    const word = "find-in-notes-target";
    const inbox = (await loadNote("inbox"))!;
    const { saveNote } = await import("../../src/notes");
    await saveNote("inbox", inbox + "\nsome text " + word + "\n");
    const pos = (inbox + "\nsome text ").length;

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
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
    await expect.poll(() => view.state.selection.main.head).toBe(pos);
  });
});
