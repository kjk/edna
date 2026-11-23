import { expect, vi } from "vitest";
import { kMetadataName } from "../../src/metadata";
import { dbDelDirHandle } from "../../src/notes";
import { modKey, press } from "./editor-ui";

export async function mountApp(notes?: Record<string, string>) {
  // The app's Vite config normally defines these for the Settings dialog.
  vi.stubGlobal("__APP_VERSION__", "test");
  vi.stubGlobal("__GIT_HASH__", "test");
  localStorage.clear();
  await dbDelDirHandle();
  if (notes) {
    for (const [name, text] of Object.entries(notes)) {
      localStorage.setItem(`note:${name}`, text);
    }
    const shortcuts = ["scratch", "daily journal", "inbox"]
      .map((name, index) => ({ name, altShortcut: String(index + 1) }))
      .filter(({ name }) => Object.hasOwn(notes, name));
    localStorage.setItem(kMetadataName, JSON.stringify({ ver: 1, notes: shortcuts, functions: [] }));
  }

  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  await import("../../src/main");
  await vi.waitFor(() => expect(root.firstElementChild).not.toBeNull());
}

export function editorElement() {
  return document.querySelector<HTMLElement>("#app [contenteditable]");
}

export function editorInput() {
  const input = editorElement();
  expect(input).not.toBeNull();
  return input!;
}

export function editorText() {
  return editorElement()?.innerText ?? "";
}

export async function pressMod(key: string, shift = false) {
  await press(key, modKey, ...(shift ? ["Shift"] : []));
}

// presses Alt + n: dispatched to window so it's synchronous and works
// regardless of which element has focus
export function altDigit(n: number) {
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

// opens note with quick access shortcut Alt + shortcut
export async function openNoteShortcut(shortcut: number, name: string) {
  altDigit(shortcut);
  await expect.poll(() => document.title).toBe(name);
  await expect.poll(editorElement).not.toBeNull();
}

// waits for an <input> matching selector to appear
export async function waitForInput(selector: string): Promise<HTMLInputElement> {
  await expect.poll(() => document.querySelector<HTMLInputElement>(selector)).not.toBeNull();
  return document.querySelector<HTMLInputElement>(selector)!;
}

// sets value of input as if the user typed it
export function setInputValue(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function pressEnterIn(el: HTMLElement) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
}

// browser back / forward to the history entry of note (or tab) name
export function popStateTo(name: string) {
  window.dispatchEvent(new PopStateEvent("popstate", { state: { noteName: name } }));
}
