import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { deleteLine } from "../../src/editor/block/delete-line";
import { modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Delete line (browser tests)", () => {
  let te: TestEditor;

  // Edna reserves the Delete Line shortcut for its command palette.
  const threeBlockContent =
    "\n∞∞∞text\nBlock A\ntext content 1\ntext content 2\ntext content 3\ntext content 4" +
    "\n∞∞∞text\nBlock B" +
    "\n∞∞∞text\nBlock C";

  beforeEach(() => {
    te = createEditor(threeBlockContent);
  });

  afterEach(() => {
    cleanup(te);
  });

  it("deletes four lines from Block A", async () => {
    await press("Home", modKey);
    for (let i = 0; i < 4; i++) {
      deleteLine(te.editor.view);
    }

    expect(visibleBlocks(te.container)).toEqual(["\ntext content 4", "Block B", "Block C"]);
  });

  it("deletes the selected line in Block B and keeps the empty block", async () => {
    await press("End", modKey);
    await press("ArrowUp");
    await press("a", modKey);
    deleteLine(te.editor.view);

    expect(visibleBlocks(te.container)).toEqual([
      "Block A\ntext content 1\ntext content 2\ntext content 3\ntext content 4",
      "",
      "Block C",
    ]);
  });
});
