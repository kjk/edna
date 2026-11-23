import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditorAndPress, modKey, press, visibleBlocks } from "./editor-ui";
import { cleanup, type TestEditor } from "./utils";

describe("Basic editing (browser tests)", () => {
  let te: TestEditor;

  async function openEditor(content = "\n∞∞∞text-a\n") {
    te = await createEditorAndPress(content, ["Home", modKey]);
  }


  afterEach(() => {
    cleanup(te);
  });

  it("enter text and create new block", async () => {
    await openEditor();
    expect(visibleBlocks(te.container)).toEqual([""]);

    await userEvent.keyboard("Hello World!{Enter}");
    await press("Enter", modKey);

    expect(visibleBlocks(te.container)).toEqual(["Hello World!", ""]);
    await expect
      .poll(() => te.container.querySelectorAll(".edna-blocks-layer > div").length)
      .toBe(2);
  });

  it("backspace", async () => {
    await openEditor();
    await userEvent.keyboard("Hello World!{Backspace>5}");
    expect(visibleBlocks(te.container)).toEqual(["Hello W"]);
  });

  it("first block is protected", async () => {
    await openEditor();
    await press("Backspace");
    expect(visibleBlocks(te.container)).toEqual([""]);
    await userEvent.keyboard("Still editable");
    expect(visibleBlocks(te.container)).toEqual(["Still editable"]);
  });

  it("insert current date and time", async () => {
    await openEditor();
    const expectedYear = new Date().toLocaleString(undefined, { year: "numeric" });
    await press("d", "Alt", "Shift");
    await expect.poll(() => visibleBlocks(te.container)[0]).toContain(expectedYear);
  });

  it("press tab", async () => {
    await openEditor();
    await userEvent.keyboard("H{Tab}ello{Enter}{Tab}");
    expect(visibleBlocks(te.container)).toEqual(["H   ello\n    "]);
  });

  it("indentation is preserved on enter in plain text block", async () => {
    await openEditor("\n∞∞∞text\n");
    await userEvent.keyboard("    Indented line{Enter}Next line");
    expect(visibleBlocks(te.container)).toEqual(["    Indented line\n    Next line"]);
  });

  it("python indentation increases after colon on enter", async () => {
    await openEditor("\n∞∞∞python\ndef func():");
    await userEvent.keyboard("{End}{Enter}");
    expect(visibleBlocks(te.container)).toEqual(["def func():\n    "]);
  });

  it("Tab inserts spaces up to the next tab stop at the cursor", async () => {
    await openEditor();
    await userEvent.keyboard("ab{Tab}c");
    expect(visibleBlocks(te.container)).toEqual(["ab  c"]);
  });

  it("Tab with a selection indents selected lines", async () => {
    await openEditor();
    await userEvent.keyboard("ab");
    await press("Home", "Shift");
    await press("Tab");
    expect(visibleBlocks(te.container)).toEqual(["    ab"]);
  });

  it("indentation is preserved on enter in math block", async () => {
    await openEditor("\n∞∞∞math\n");
    await userEvent.keyboard("  x = 1{Enter}x");
    expect(visibleBlocks(te.container)).toEqual(["  x = 1\n  x"]);
  });
});
