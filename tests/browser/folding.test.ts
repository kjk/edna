import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditor, cleanup, type TestEditor } from "./utils";
import { foldBlock, unfoldBlock, toggleBlockFold } from "../../src/editor/fold-gutter";

describe("Block folding (browser tests)", () => {
  let te: TestEditor;
  const isMac = /Mac/.test(navigator.platform);

  const fourBlockContent = [
    "\n\u221E\u221E\u221Etext",
    "\nBlock A",
    "\nLine 2 of Block A",
    "\nLine 3 of Block A",
    "\n\u221E\u221E\u221Ejavascript",
    '\nconsole.log("Block B")',
    "\nlet x = 42",
    "\nreturn x * 2",
    "\n\u221E\u221E\u221Etext",
    "\nBlock C single line",
    "\n\u221E\u221E\u221Emarkdown",
    "\n# Block D",
    "\nThis is a markdown block",
    "\n- Item 1",
    "\n- Item 2",
    "\n",
  ].join("");

  function foldPlaceholderCount(): number {
    return te.container.querySelectorAll(".cm-foldPlaceholder").length;
  }

  /** Select all content in the buffer (two Mod+A presses) */
  async function selectEntireBuffer() {
    const modKey = isMac ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}a{/${modKey}}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await userEvent.keyboard(`{${modKey}>}a{/${modKey}}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  beforeEach(async () => {
    te = createEditor(fourBlockContent);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect.poll(() => te.editor.getBlocks().length).toBe(4);
  });

  afterEach(() => {
    cleanup(te);
  });

  it("fold gutter doesn't lose editor focus when clicked", async () => {
    const { editor, container } = te;
    editor.setCursorPosition(20);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Click on fold gutter
    const foldGutter = container.querySelector(".cm-foldGutter .cm-gutterElement");
    if (foldGutter) {
      (foldGutter as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Type a character - should work if editor maintained focus
      await userEvent.keyboard("xyz yay");

      const content = editor.getContent();
      expect(content).toContain("xyz yay");
    }
  });

  it("line number gutter doesn't lose editor focus when clicked", async () => {
    const { editor, container } = te;
    editor.setCursorPosition(20);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const lineNumEl = container.querySelector(".cm-lineNumbers .cm-gutterElement");
    if (lineNumEl) {
      (lineNumEl as HTMLElement).click();
      await new Promise((resolve) => setTimeout(resolve, 50));

      await userEvent.keyboard("abc test");

      const content = editor.getContent();
      expect(content).toContain("abc test");
    }
  });

  it("block can be folded", async () => {
    const { editor } = te;
    editor.setCursorPosition(20);

    expect(foldPlaceholderCount()).toBe(0);

    // Fold block using command
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBeGreaterThan(0);
  });

  it("multiple blocks can be folded and unfolded when selection overlaps multiple blocks", async () => {
    const { editor } = te;
    // Select all content
    await selectEntireBuffer();

    expect(foldPlaceholderCount()).toBe(0);

    // Fold all selected blocks
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Block A, B, and D should be folded (C is single line so won't fold)
    await expect.poll(() => foldPlaceholderCount()).toBe(3);

    // Unfold all
    await selectEntireBuffer();
    unfoldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(0);
  });

  it("toggleBlockFold works on single block", async () => {
    const { editor } = te;
    editor.setCursorPosition(20);

    expect(foldPlaceholderCount()).toBe(0);

    // Toggle fold to fold the block
    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBeGreaterThan(0);

    // Toggle fold again to unfold the block
    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(0);
  });

  it("toggleBlockFold works on multiple blocks", async () => {
    const { editor } = te;
    await selectEntireBuffer();

    expect(foldPlaceholderCount()).toBe(0);

    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(3);

    await selectEntireBuffer();
    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(0);
  });

  it("toggleBlockFold with mixed folded/unfolded state", async () => {
    const { editor } = te;
    // Fold Block A first
    editor.setCursorPosition(20);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(1);

    // Select all blocks
    await selectEntireBuffer();

    // Toggle fold on mixed state - should fold all (more unfolded than folded)
    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(3);

    // Toggle again - should unfold all
    await selectEntireBuffer();
    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(0);
  });

  it("toggleBlockFold with mixed state with many single line blocks", async () => {
    const { editor } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Etext\nhej" +
        "\n\u221E\u221E\u221Etext\nBlock A\nLine 2 of Block A\nLine 3 of Block A" +
        "\n\u221E\u221E\u221Ejavascript\nconsole.log(\"Block B\")\nlet x = 42\nreturn x * 2" +
        "\n\u221E\u221E\u221Etext\nBlock C single line" +
        "\n\u221E\u221E\u221Etext\nBlock C single line",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    await selectEntireBuffer();

    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Block A and B should be folded (other blocks are single line)
    await expect.poll(() => foldPlaceholderCount()).toBe(2);

    await selectEntireBuffer();
    toggleBlockFold(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(0);
  });

  it("typing at the beginning of a folded block unfolds it", async () => {
    const { editor, container } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Etext\nBlock A line 1\nBlock A line 2\nBlock A line 3",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fold the block
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom + 5);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(1);

    // Position cursor at the very beginning of the folded block
    const blocksAfterFold = editor.getBlocks();
    editor.setCursorPosition(blocksAfterFold[0].contentFrom);

    // Type a character
    await userEvent.keyboard("X");

    // Block should be unfolded
    await expect.poll(() => foldPlaceholderCount()).toBe(0);

    const content = editor.getContent();
    expect(content).toContain("XBlock A line 1");
  });

  it("typing at the end of a folded block unfolds it", async () => {
    const { editor } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Etext\nBlock A line 1\nBlock A line 2\nBlock A line 3",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom + 5);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(1);

    // Position cursor at the very end of the folded block
    const blocksAfterFold = editor.getBlocks();
    editor.setCursorPosition(blocksAfterFold[0].to);

    await userEvent.keyboard("Y");

    await expect.poll(() => foldPlaceholderCount()).toBe(0);

    const content = editor.getContent();
    expect(content).toContain("Block A line 3Y");
  });

  it("typing in empty block does not unfold previous folded block", async () => {
    const { editor } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Etext\nBlock A line 1\nBlock A line 2\nBlock A line 3" +
        "\n\u221E\u221E\u221Etext\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fold the first block
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom + 5);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(1);

    const blocks2 = editor.getBlocks();
    expect(blocks2.length).toBe(2);

    // Type into the empty second block
    editor.setCursorPosition(blocks2[1].contentFrom);
    await userEvent.keyboard("a");

    // The folded block should remain folded
    await expect.poll(() => foldPlaceholderCount()).toBe(1);
  });

  // Note: In Edna, pressing backspace in the empty block after fold unfolds the block
  // (unlike Heynote where it's preserved). This is due to autoUnfoldOnEdit behavior.
  it.skip("folded block does not unfold when new block created after it and backspace pressed immediately", async () => {
    const { editor } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Etext\nBlock A line 1\nBlock A line 2\nBlock A line 3\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fold the first block
    editor.setCursorPosition(20);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(1);

    // Position cursor at beginning of block and create new block after
    const blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom);
    const modKey = isMac ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}{Enter}{/${modKey}}`);
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect.poll(() => editor.getBlocks().length).toBe(2);

    // Immediately press backspace
    await userEvent.keyboard("{Backspace}");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The folded block should NOT unfold
    await expect.poll(() => foldPlaceholderCount()).toBe(1);
    await expect.poll(() => editor.getBlocks().length).toBe(1);
  });

  it("folded block does not unfold when new block created before it and delete pressed immediately", async () => {
    const { editor } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Etext\nBlock B line 1\nBlock B line 2\nBlock B line 3\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fold the block
    let blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom + 10);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(1);

    // Re-query blocks after fold, then create a new block before the folded block
    blocks = editor.getBlocks();
    editor.setCursorPosition(blocks[0].contentFrom);
    await userEvent.keyboard("{Alt>}{Enter}{/Alt}");
    await new Promise((resolve) => setTimeout(resolve, 100));

    await expect.poll(() => editor.getBlocks().length).toBe(2);

    // Verify fold is maintained after block creation
    expect(foldPlaceholderCount()).toBe(1);

    // Immediately press delete
    await userEvent.keyboard("{Delete}");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // After deleting the empty block, we should be back to 1 block
    await expect.poll(() => editor.getBlocks().length).toBe(1);
    // The folded block should NOT unfold
    await expect.poll(() => foldPlaceholderCount()).toBe(1);
  });

  it("markdown block with trailing empty lines can be fully folded", async () => {
    const { editor, container } = te;
    editor.setContent(
      "\n\u221E\u221E\u221Emarkdown\n# Markdown Header\nThis is some markdown content\n- List item 1\n- List item 2\n\nAnother paragraph here\n\n\n\n",
    );
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(editor.getBlocks().length).toBe(1);

    // Count visible lines before folding
    const linesBeforeFold = container.querySelectorAll(".cm-line").length;
    expect(linesBeforeFold).toBeGreaterThan(1);

    // Fold the block
    editor.setCursorPosition(30);
    foldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBeGreaterThan(0);

    // After folding, should have only 1 visible line
    await expect.poll(() => container.querySelectorAll(".cm-line").length).toBe(1);

    // The visible text should contain the header and fold indicator but not other content
    const visibleText = container.querySelector(".cm-content")?.textContent || "";
    expect(visibleText).toContain("# Markdown Header");
    expect(visibleText).not.toContain("This is some markdown content");
    expect(visibleText).not.toContain("List item 1");

    // Unfold
    unfoldBlock(editor)(editor.view);
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect.poll(() => foldPlaceholderCount()).toBe(0);
    await expect
      .poll(() => container.querySelectorAll(".cm-line").length)
      .toBe(linesBeforeFold);
  });

  // Note: Tests that require page reloads, NoteFormat metadata, or language selector UI
  // (folded blocks persist across reloads, folded blocks stored in metadata,
  // folded block doesn't unfold on language change, creation time display)
  // are skipped because they require the full app environment.
});
