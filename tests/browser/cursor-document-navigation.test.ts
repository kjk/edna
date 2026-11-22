import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Cursor document navigation (browser tests)", () => {
  let te: TestEditor;

  const threeBlockContent = [
    "\n∞∞∞text",
    "\nFirst block content",
    "\n∞∞∞javascript",
    '\nconsole.log("second block")',
    "\n∞∞∞markdown",
    "\n# Third block",
    "\nSome markdown content\n",
  ].join("");

  function blocks() {
    return visibleBlocks(te.container);
  }

  afterEach(() => {
    cleanup(te);
  });

  it("moves to the beginning of the document", async () => {
    te = createEditor(threeBlockContent);
    await press("End", modKey);
    await press("Home", modKey);
    await userEvent.keyboard("X");

    expect(blocks()[0]).toBe("XFirst block content");
  });

  it("moves to the end of the document", async () => {
    te = createEditor(threeBlockContent);
    await press("Home", modKey);
    await press("End", modKey);
    await userEvent.keyboard("X");

    expect(blocks()[2]).toBe("# Third block\nSome markdown content\nX");
  });

  it("selects from the cursor to the beginning of the document", async () => {
    te = createEditor(threeBlockContent);
    await press("Home", modKey);
    await userEvent.keyboard("{ArrowDown}{ArrowRight>13}");
    await press("Home", modKey, "Shift");
    await userEvent.keyboard("X");

    expect(blocks()).toEqual(['Xsecond block")', "# Third block\nSome markdown content\n"]);
  });

  it("selects from the cursor to the end of the document", async () => {
    te = createEditor(threeBlockContent);
    await press("Home", modKey);
    await userEvent.keyboard("{ArrowRight>15}");
    await press("End", modKey, "Shift");
    await userEvent.keyboard("X");

    expect(blocks()).toEqual(["First block conX"]);
  });

  it("cursor navigation works with empty blocks", async () => {
    te = createEditor("\n∞∞∞text\n\n∞∞∞javascript\n\n∞∞∞markdown\n");

    await press("End", modKey);
    await press("Home", modKey);
    await userEvent.keyboard("A");
    expect(blocks()).toEqual(["A", "", ""]);

    await press("End", modKey);
    await userEvent.keyboard("C");
    expect(blocks()).toEqual(["A", "", "C"]);
  });

  it("cursor cannot be set within block delimiter", async () => {
    te = createEditor("\n∞∞∞text\nhello");

    te.editor.setCursorPosition(0);
    expect(te.editor.getCursorPosition()).toBe(te.editor.getBlocks()[0].contentFrom);
    await userEvent.keyboard("X");

    expect(blocks()).toEqual(["Xhello"]);
  });

  it("selection starting before first block is clamped to first block content", async () => {
    te = createEditor(threeBlockContent);
    const { view } = te.editor;

    const end = view.state.doc.length;
    view.dispatch({ selection: { anchor: 0, head: end } });
    expect(view.state.selection.main).toMatchObject({
      anchor: te.editor.getBlocks()[0].contentFrom,
      head: end,
    });
    await userEvent.keyboard("X");

    expect(blocks()).toEqual(["X"]);
  });

  it("cursor navigation works in single block", async () => {
    te = createEditor("\n∞∞∞text\nSingle block with some content\n");
    await press("Home", modKey);
    await userEvent.keyboard("{ArrowRight>10}");

    await press("Home", modKey);
    await userEvent.keyboard("A");
    await press("End", modKey);
    await userEvent.keyboard("Z");

    expect(blocks()).toEqual(["ASingle block with some content\nZ"]);
  });
});
