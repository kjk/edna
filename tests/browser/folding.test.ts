import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { editorLines, modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Block folding (browser tests)", () => {
  let te: TestEditor;

  const fourBlockContent = [
    "\n∞∞∞text",
    "\nBlock A",
    "\nLine 2 of Block A",
    "\nLine 3 of Block A",
    "\n∞∞∞javascript",
    '\nconsole.log("Block B")',
    "\nlet x = 42",
    "\nreturn x * 2",
    "\n∞∞∞text",
    "\nBlock C single line",
    "\n∞∞∞markdown",
    "\n# Block D",
    "\nThis is a markdown block",
    "\n- Item 1",
    "\n- Item 2",
    "\n",
  ].join("");

  const firstBlock = "\n∞∞∞text\nBlock A line 1\nBlock A line 2\nBlock A line 3";

  async function openEditor(content = fourBlockContent) {
    te = createEditor(content);
    await press("Home", modKey);
    await press("ArrowRight");
  }

  function foldPlaceholderCount() {
    return te.container.querySelectorAll(".cm-foldPlaceholder").length;
  }

  function blockCount() {
    return te.container.querySelectorAll(".heynote-block-start").length;
  }

  function fold() {
    return press("[", modKey, "Alt");
  }

  function unfold() {
    return press("]", modKey, "Alt");
  }

  function toggleFold() {
    return press(".", modKey, "Alt");
  }

  async function selectEntireBuffer() {
    await press("a", modKey);
    await press("a", modKey);
  }

  afterEach(() => {
    cleanup(te);
  });

  // On Mac, Option+Period produces "≥". This event exercises CodeMirror's keyCode fallback.
  it("Mod-Alt-. toggles block fold when Alt changes event.key (Mac)", async () => {
    await openEditor();
    const editor = te.container.querySelector(".cm-content")!;
    const opts = {
      key: modKey === "Meta" ? "≥" : ".",
      code: "Period",
      keyCode: 190,
      altKey: true,
      metaKey: modKey === "Meta",
      ctrlKey: modKey === "Control",
      bubbles: true,
      cancelable: true,
    };
    editor.dispatchEvent(new KeyboardEvent("keydown", opts));
    await expect.poll(foldPlaceholderCount).toBe(1);
    editor.dispatchEvent(new KeyboardEvent("keydown", opts));
    await expect.poll(foldPlaceholderCount).toBe(0);
  });

  function visibleGutterElement(gutterSelector: string): HTMLElement {
    const elements = te.container.querySelectorAll<HTMLElement>(`${gutterSelector} .cm-gutterElement`);
    const element = [...elements].find((el) => el.style.visibility !== "hidden" && el.offsetHeight > 0);
    expect(element).toBeDefined();
    return element!;
  }

  it.each([
    ["fold", ".cm-foldGutter"],
    ["line number", ".cm-lineNumbers"],
  ])("%s gutter preserves editor focus when clicked", async (_, selector) => {
    await openEditor();
    const editor = te.container.querySelector(".cm-content");
    expect(document.activeElement).toBe(editor);

    await userEvent.click(visibleGutterElement(selector));
    expect(document.activeElement).toBe(editor);

    await userEvent.keyboard("xyz yay");
    expect(visibleBlocks(te.container).join("\n")).toContain("xyz yay");
  });

  it("block can be folded", async () => {
    await openEditor();
    expect(foldPlaceholderCount()).toBe(0);
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);
  });

  it("multiple blocks can be folded and unfolded when selection overlaps multiple blocks", async () => {
    await openEditor();
    await selectEntireBuffer();
    expect(foldPlaceholderCount()).toBe(0);

    await fold();
    await expect.poll(foldPlaceholderCount).toBe(3);

    await selectEntireBuffer();
    await unfold();
    await expect.poll(foldPlaceholderCount).toBe(0);
  });

  it("toggleBlockFold works on single block", async () => {
    await openEditor();
    expect(foldPlaceholderCount()).toBe(0);

    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(1);

    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(0);
  });

  it("toggleBlockFold works on multiple blocks", async () => {
    await openEditor();
    await selectEntireBuffer();
    expect(foldPlaceholderCount()).toBe(0);

    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(3);

    await selectEntireBuffer();
    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(0);
  });

  it("toggleBlockFold with mixed folded/unfolded state", async () => {
    await openEditor();
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);

    await selectEntireBuffer();
    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(3);

    await selectEntireBuffer();
    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(0);
  });

  it("toggleBlockFold with mixed state with many single line blocks", async () => {
    await openEditor(
      "\n∞∞∞text\nhej" +
        "\n∞∞∞text\nBlock A\nLine 2 of Block A\nLine 3 of Block A" +
        '\n∞∞∞javascript\nconsole.log("Block B")\nlet x = 42\nreturn x * 2' +
        "\n∞∞∞text\nBlock C single line" +
        "\n∞∞∞text\nBlock C single line",
    );
    await selectEntireBuffer();
    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(2);

    await selectEntireBuffer();
    await toggleFold();
    await expect.poll(foldPlaceholderCount).toBe(0);
  });

  it("typing at the beginning of a folded block unfolds it", async () => {
    await openEditor(firstBlock);
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);

    await press("Home", modKey);
    await userEvent.keyboard("X");

    await expect.poll(foldPlaceholderCount).toBe(0);
    expect(visibleBlocks(te.container)).toEqual(["XBlock A line 1\nBlock A line 2\nBlock A line 3"]);
  });

  it("typing at the end of a folded block unfolds it", async () => {
    await openEditor(firstBlock);
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);

    await press("End", modKey);
    await userEvent.keyboard("Y");

    await expect.poll(foldPlaceholderCount).toBe(0);
    expect(visibleBlocks(te.container)).toEqual(["Block A line 1\nBlock A line 2\nBlock A line 3Y"]);
  });

  it("typing in empty block does not unfold previous folded block", async () => {
    await openEditor(firstBlock + "\n∞∞∞text\n");
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);
    expect(blockCount()).toBe(2);

    await press("End", modKey);
    await userEvent.keyboard("a");

    await expect.poll(foldPlaceholderCount).toBe(1);
    expect(visibleBlocks(te.container)[1]).toBe("a");
  });

  it("folded block does not unfold when new block created after it and backspace pressed immediately", async () => {
    await openEditor(firstBlock + "\n");
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);

    await press("Home", modKey);
    await press("Enter", modKey);
    await expect.poll(blockCount).toBe(2);

    await press("Backspace");
    await expect.poll(blockCount).toBe(1);
    expect(foldPlaceholderCount()).toBe(1);
  });

  it("folded block does not unfold when new block created before it and delete pressed immediately", async () => {
    await openEditor(firstBlock + "\n");
    await fold();
    await expect.poll(foldPlaceholderCount).toBe(1);

    await press("Home", modKey);
    await press("Enter", "Alt");
    await expect.poll(blockCount).toBe(2);
    expect(foldPlaceholderCount()).toBe(1);

    await press("Delete");
    await expect.poll(blockCount).toBe(1);
    expect(foldPlaceholderCount()).toBe(1);
  });

  it("markdown block with trailing empty lines can be fully folded", async () => {
    await openEditor(
      "\n∞∞∞markdown\n# Markdown Header\nThis is some markdown content\n- List item 1\n- List item 2\n\nAnother paragraph here\n\n\n\n",
    );
    expect(blockCount()).toBe(1);
    const linesBeforeFold = editorLines(te.container).length;
    expect(linesBeforeFold).toBeGreaterThan(1);

    await fold();

    await expect.poll(foldPlaceholderCount).toBe(1);
    await expect.poll(() => editorLines(te.container).length).toBe(1);
    const visibleText = te.container.querySelector(".cm-content")?.textContent ?? "";
    expect(visibleText).toContain("# Markdown Header");
    expect(visibleText).not.toContain("This is some markdown content");
    expect(visibleText).not.toContain("List item 1");

    await unfold();

    await expect.poll(foldPlaceholderCount).toBe(0);
    await expect.poll(() => editorLines(te.container).length).toBe(linesBeforeFold);
  });
});
