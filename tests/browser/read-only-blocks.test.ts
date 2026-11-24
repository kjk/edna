import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { changeCurrentBlockLanguage, deleteBlock, moveCurrentBlockUp } from "../../src/editor/block/commands";
import { readOnlyBlocksKept, toggleBlockReadOnly } from "../../src/editor/read-only-blocks";
import { cleanup, createEditor, type TestEditor } from "./utils";

// blocks with -ro delimiter can't be changed (#57)
describe("read-only blocks", () => {
  let te: TestEditor;
  const content = "\n∞∞∞text\nfirst\n∞∞∞text-ro\nlocked\n∞∞∞text\nlast";

  afterEach(() => {
    cleanup(te);
  });

  function setup(cursorAt: string): TestEditor {
    te = createEditor(content);
    const view = te.editor.view;
    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf(cursorAt) } });
    view.focus();
    return te;
  }

  const doc = () => te.editor.view.state.doc.toString();

  it("readOnlyBlocksKept", () => {
    expect(readOnlyBlocksKept(content, content)).toBe(true);
    expect(readOnlyBlocksKept(content, content.replace("first", "1st"))).toBe(true);
    expect(readOnlyBlocksKept(content, content.replace("locked", "lockedX"))).toBe(false);
    // moved: still there
    expect(readOnlyBlocksKept(content, "\n∞∞∞text-ro\nlocked\n∞∞∞text\nfirst\n∞∞∞text\nlast")).toBe(true);
    // merged with the next block by deleting its delimiter
    expect(readOnlyBlocksKept(content, "\n∞∞∞text\nfirst\n∞∞∞text-ro\nlocked\nlast")).toBe(false);
    // language changed
    expect(readOnlyBlocksKept(content, content.replace("text-ro", "markdown-ro"))).toBe(false);
  });

  it("typing in a read-only block does nothing, other blocks can be edited", async () => {
    setup("locked");
    await userEvent.keyboard("abc");
    await userEvent.keyboard("{Backspace}");
    expect(doc()).toBe(content);
    te.editor.view.dispatch({ selection: { anchor: doc().indexOf("last") } });
    await userEvent.keyboard("X");
    expect(doc()).toBe(content.replace("last", "Xlast"));
  });

  it("typing at the end of the block before a read-only block works", async () => {
    setup("first");
    te.editor.view.dispatch({ selection: { anchor: doc().indexOf("first") + 5 } });
    await userEvent.keyboard("!");
    expect(doc()).toBe(content.replace("first", "first!"));
  });

  it("deleting the delimiter after a read-only block (merging into it) does nothing", async () => {
    setup("last");
    await userEvent.keyboard("{Backspace}");
    expect(doc()).toBe(content);
  });

  it("a read-only block can be moved but not deleted or have its language changed", () => {
    setup("locked");
    const view = te.editor.view;
    moveCurrentBlockUp(view);
    expect(doc()).toBe("\n∞∞∞text-ro\nlocked\n∞∞∞text\nfirst\n∞∞∞text\nlast");
    deleteBlock(te.editor)(view);
    expect(doc()).toContain("locked");
    changeCurrentBlockLanguage(view, "markdown", false);
    expect(doc()).toContain("∞∞∞text-ro\nlocked");
  });

  it("toggle read-only", async () => {
    setup("locked");
    const view = te.editor.view;
    toggleBlockReadOnly(view);
    expect(doc()).toBe(content.replace("text-ro", "text"));
    await userEvent.keyboard("A");
    expect(doc()).toContain("Alocked");
    toggleBlockReadOnly(view);
    expect(doc()).toContain("∞∞∞text-ro\nAlocked");
  });

  it("loading other content replaces read-only blocks", () => {
    setup("locked");
    te.editor.setContent("\n∞∞∞text\nnew");
    expect(doc()).toBe("\n∞∞∞text\nnew");
  });

  it("shows a read-only badge", () => {
    setup("locked");
    expect(te.container.querySelectorAll(".cm-edna-ro-badge").length).toBe(1);
    expect(te.container.querySelectorAll(".cm-edna-ro-line").length).toBe(1);
  });
});
