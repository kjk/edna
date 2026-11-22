import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Basic editing (browser tests)", () => {
  let te: TestEditor;

  async function openEditor(content = "\n∞∞∞text-a\n") {
    te = createEditor(content);
    await press("Home", modKey);
  }

  function blocks() {
    return visibleBlocks(te.container);
  }

  afterEach(() => {
    cleanup(te);
  });

  it("enter text and create new block", async () => {
    await openEditor();
    expect(blocks()).toEqual([""]);

    await userEvent.keyboard("Hello World!{Enter}");
    await press("Enter", modKey);

    expect(blocks()).toEqual(["Hello World!", ""]);
    await expect
      .poll(() => te.container.querySelectorAll(".heynote-blocks-layer > div").length)
      .toBe(2);
  });

  it("backspace", async () => {
    await openEditor();
    await userEvent.keyboard("Hello World!{Backspace>5}");
    expect(blocks()).toEqual(["Hello W"]);
  });

  it("first block is protected", async () => {
    await openEditor();
    await press("Backspace");
    expect(blocks()).toEqual([""]);
    await userEvent.keyboard("Still editable");
    expect(blocks()).toEqual(["Still editable"]);
  });

  it("insert current date and time", async () => {
    await openEditor();
    const expectedYear = new Date().toLocaleString(undefined, { year: "numeric" });
    await press("d", "Alt", "Shift");
    await expect.poll(() => blocks()[0]).toContain(expectedYear);
  });

  it("press tab", async () => {
    await openEditor();
    await userEvent.keyboard("H{Tab}ello{Enter}{Tab}");
    expect(blocks()).toEqual(["H   ello\n    "]);
  });

  it("indentation is preserved on enter in plain text block", async () => {
    await openEditor("\n∞∞∞text\n");
    await userEvent.keyboard("    Indented line{Enter}Next line");
    expect(blocks()).toEqual(["    Indented line\n    Next line"]);
  });

  it("python indentation increases after colon on enter", async () => {
    await openEditor("\n∞∞∞python\ndef func():");
    await userEvent.keyboard("{End}{Enter}");
    expect(blocks()).toEqual(["def func():\n    "]);
  });

  it("Tab inserts spaces up to the next tab stop at the cursor", async () => {
    await openEditor();
    await userEvent.keyboard("ab{Tab}c");
    expect(blocks()).toEqual(["ab  c"]);
  });

  it("Tab with a selection indents selected lines", async () => {
    await openEditor();
    await userEvent.keyboard("ab");
    await press("Home", "Shift");
    await press("Tab");
    expect(blocks()).toEqual(["    ab"]);
  });

  it("indentation is preserved on enter in math block", async () => {
    await openEditor("\n∞∞∞math\n");
    await userEvent.keyboard("  x = 1{Enter}x");
    expect(blocks()).toEqual(["  x = 1\n  x"]);
  });
});
