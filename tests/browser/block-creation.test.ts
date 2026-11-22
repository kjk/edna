import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Block creation (browser tests)", () => {
  let te: TestEditor;
  const threeBlockContent = "\n∞∞∞text\nBlock A\n∞∞∞text\nBlock B\n∞∞∞text\nBlock C";

  async function openEditor(content = threeBlockContent) {
    te = createEditor(content);
    await press("End", modKey);
  }

  function blocks() {
    return visibleBlocks(te.container);
  }

  async function runTest(expectedBlocks: string[], ...modifiers: string[]) {
    expect(blocks()).toEqual(["Block A", "Block B", "Block C"]);
    await expect.poll(() => te.container.querySelectorAll(".edna-blocks-layer > div").length).toBe(3);

    await press("Enter", ...modifiers);
    await userEvent.keyboard("Block D");

    expect(blocks()).toEqual(expectedBlocks.map((name) => `Block ${name}`));
    await expect.poll(() => te.container.querySelectorAll(".edna-block-start.first").length).toBe(1);
  }

  afterEach(() => {
    cleanup(te);
  });

  it("create block before current (A)", async () => {
    await openEditor();
    await userEvent.keyboard("{ArrowUp>2}");
    await runTest(["D", "A", "B", "C"], "Alt");
  });

  it("create block after current (A)", async () => {
    await openEditor();
    await userEvent.keyboard("{ArrowUp>2}");
    await runTest(["A", "D", "B", "C"], modKey);
  });

  it("create block before current (B)", async () => {
    await openEditor();
    await press("ArrowUp");
    await runTest(["A", "D", "B", "C"], "Alt");
  });

  it("create block after current (B)", async () => {
    await openEditor();
    await press("ArrowUp");
    await runTest(["A", "B", "D", "C"], modKey);
  });

  it("create block before current (C)", async () => {
    await openEditor();
    await runTest(["A", "B", "D", "C"], "Alt");
  });

  it("create block after current (C)", async () => {
    await openEditor();
    await runTest(["A", "B", "C", "D"], modKey);
  });

  it("create block before first", async () => {
    await openEditor();
    await runTest(["D", "A", "B", "C"], "Alt", "Shift");
  });

  it("create block after last", async () => {
    await openEditor();
    await press("Home", modKey);
    await runTest(["A", "B", "C", "D"], modKey, "Shift");
  });

  it("create block before Markdown block", async () => {
    await openEditor("\n∞∞∞markdown\n# Markdown!\n");
    await press("Home", modKey);
    await press("Enter", "Alt");
    await userEvent.keyboard("New block");

    expect(blocks()).toEqual(["New block", "# Markdown!\n"]);
  });

  it("create block before first Markdown block", async () => {
    await openEditor("\n∞∞∞markdown\n# Markdown!\n\n∞∞∞text\n");
    await press("Enter", "Alt", "Shift");
    await userEvent.keyboard("New block");

    expect(blocks()).toEqual(["New block", "# Markdown!\n", ""]);
  });

  it("new blocks use the default block language", async () => {
    await openEditor();
    te.editor.setDefaultBlockLanguage("markdown", false);
    await press("Enter", modKey, "Shift");
    expect(blocks()).toEqual(["Block A", "Block B", "Block C", ""]);
    expect(te.editor.getBlocks()[3]).toMatchObject({ language: "markdown", autoDetect: false });
  });
});
