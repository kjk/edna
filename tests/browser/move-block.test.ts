import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { modKey, press, visibleBlocks } from "./editor-ui";
import { createEditor, cleanup, type TestEditor } from "./utils";

describe("Move block (browser tests)", () => {
  let te: TestEditor;

  const threeBlockContent = "\n∞∞∞text\nBlock A\n∞∞∞text\nBlock B\n∞∞∞text\nBlock C";

  function moveBlock(direction: "ArrowUp" | "ArrowDown") {
    return press(direction, "Alt", modKey, "Shift");
  }

  afterEach(() => {
    cleanup(te);
  });

  it.each([
    ["move the first block up", 2, "ArrowUp", ["A", "B", "C"], "A"],
    ["move the middle block up", 1, "ArrowUp", ["B", "A", "C"], "B"],
    ["move the last block up", 0, "ArrowUp", ["A", "C", "B"], "C"],
    ["move the first block down", 2, "ArrowDown", ["B", "A", "C"], "A"],
    ["move the middle block down", 1, "ArrowDown", ["A", "C", "B"], "B"],
    ["move the last block down", 0, "ArrowDown", ["A", "B", "C"], "C"],
  ] as const)("%s", async (_, steps, direction, order, active) => {
    te = createEditor(threeBlockContent);
    await press("End", modKey);
    if (steps) await userEvent.keyboard(`{ArrowUp>${steps}}`);
    expect(visibleBlocks(te.container)).toEqual(["Block A", "Block B", "Block C"]);

    await moveBlock(direction);
    expect(visibleBlocks(te.container)).toEqual(order.map((name) => `Block ${name}`));
    await userEvent.keyboard("!");
    expect(visibleBlocks(te.container)).toEqual(order.map((name) => `Block ${name}${name === active ? "!" : ""}`));
  });

  it("move block down with a selection extending into the next block (U14)", async () => {
    te = createEditor("\n∞∞∞text\nA\n∞∞∞text\nB\n∞∞∞text\nC");
    await press("End", modKey);
    await userEvent.keyboard("{Shift>}{ArrowUp}{Home}{/Shift}");

    await moveBlock("ArrowDown");
    expect(visibleBlocks(te.container)).toEqual(["A", "C", "B"]);

    await userEvent.keyboard("X");
    expect(visibleBlocks(te.container)).toEqual(["A", "C", "X"]);
  });
});
