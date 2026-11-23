import { userEvent } from "vitest/browser";
import { cleanup, createEditor, type TestEditor } from "./utils";

export const modKey = /Mac/.test(navigator.platform) ? "Meta" : "Control";

export function press(key: string, ...modifiers: string[]) {
  const down = modifiers.map((modifier) => `{${modifier}>}`).join("");
  const up = modifiers.toReversed().map((modifier) => `{/${modifier}}`).join("");
  // A real keyboard reports a shifted letter in upper case, which `{k}` does
  // not. Outside macOS, CodeMirror resolves a lower case "k" with Shift held
  // as Mod-k before Mod-Shift-k.
  if (modifiers.includes("Shift") && modifiers.includes(modKey) && /^[a-z]$/.test(key)) {
    key = `Key${key.toUpperCase()}`;
  }
  return userEvent.keyboard(`${down}{${key}}${up}`);
}

export function editorLines(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".cm-content > .cm-line")];
}

// text of syntax highlighted spans in the editor (not bracket matching marks)
export function highlightedTokens(container: HTMLElement): (string | null)[] {
  return editorLines(container).flatMap((line) =>
    Array.from(
      line.querySelectorAll("span[class]:not(.cm-matchingBracket, .cm-nonmatchingBracket)"),
      (span) => span.textContent,
    ),
  );
}

export function visibleBlocks(container: HTMLElement): string[] {
  const blocks: string[][] = [];
  for (const element of container.querySelectorAll(".cm-content > *")) {
    if (element.classList.contains("edna-block-start")) {
      blocks.push([]);
    } else if (element.classList.contains("cm-line")) {
      const line = element.cloneNode(true) as HTMLElement;
      for (const widget of line.querySelectorAll('[contenteditable="false"]')) {
        widget.remove();
      }
      blocks.at(-1)?.push(line.textContent ?? "");
    }
  }
  return blocks.map((lines) => lines.join("\n"));
}

export function pasteText(container: HTMLElement, text: string) {
  const clipboard = new DataTransfer();
  clipboard.setData("text/plain", text);
  container.querySelector(".cm-content")!.dispatchEvent(
    new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }),
  );
}

// creates a test editor and presses keys, e.g. to place the cursor.
// Each press is [key, ...modifiers]
export async function createEditorAndPress(content: string, ...presses: string[][]): Promise<TestEditor> {
  const te = createEditor(content);
  try {
    for (const [key, ...modifiers] of presses) {
      await press(key!, ...modifiers);
    }
  } catch (e) {
    cleanup(te);
    throw e;
  }
  return te;
}
