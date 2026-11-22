import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { newCursorBelow } from "../../src/editor/block/commands";
import { editorLines, modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Multiple cursors (browser tests)", () => {
  let te: TestEditor;

  function cursorCount() {
    return te.container.querySelectorAll(".cm-cursor").length;
  }

  function openEditor(content: string) {
    te = createEditor(content);
    te.container.querySelector<HTMLElement>(".cm-editor")!.style.height = "240px";
  }

  async function placeCursors(lineCount: number) {
    const [first, ...remaining] = editorLines(te.container).slice(0, lineCount);
    const position = { x: 5, y: 5 };
    await userEvent.click(first, { position });
    for (const line of remaining) {
      await userEvent.click(line, { position, modifiers: ["Alt"] });
    }
  }

  afterEach(() => {
    cleanup(te);
  });

  it("newCursorBelow adds one cursor per invocation", async () => {
    openEditor("\n∞∞∞text\nFirst line\nSecond line\nThird line\nFourth line");
    await press("Home", modKey);
    await expect.poll(cursorCount).toBe(1);

    // The shortcut also runs CodeMirror's secondary binding for the same key.
    newCursorBelow(te.editor.view);
    await expect.poll(cursorCount).toBe(2);
    newCursorBelow(te.editor.view);
    await expect.poll(cursorCount).toBe(3);
  });

  it("Alt+Click can add cursors on three more lines", async () => {
    openEditor("\n∞∞∞text\nFirst line\nSecond line\nThird line\nFourth line");
    await placeCursors(4);
    await expect.poll(cursorCount).toBe(4);
  });

  it("typing inserts text at every cursor", async () => {
    openEditor("\n∞∞∞text\nLine 1\nLine 2\nLine 3\n");
    await placeCursors(3);
    await press("End");
    await expect.poll(cursorCount).toBe(3);
    await userEvent.keyboard(">> ");

    expect(visibleBlocks(te.container)).toEqual(["Line 1>> \nLine 2>> \nLine 3>> \n"]);
  });

  it("Alt+Click creates an additional cursor", async () => {
    openEditor("\n∞∞∞text\nFirst line of content\nSecond line of content\nThird line of content\n");
    await placeCursors(2);
    await expect.poll(cursorCount).toBe(2);
  });
});
