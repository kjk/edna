import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { editorLines, highlightedTokens, modKey, press, visibleBlocks } from "./editor-ui";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Languages", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  it("highlights Mermaid diagram syntax", async () => {
    te = createEditor("\n∞∞∞mermaid\ngraph TD\n  A --> B\n");

    await expect.poll(() => highlightedTokens(te!.container)).toContain("graph");
  });

  it("highlights numbers in math expressions", async () => {
    te = createEditor("\n∞∞∞math\nx = 1 + 2\n");

    await expect.poll(() => highlightedTokens(te!.container)).toContain("2");
  });

  it("leaves diagram syntax and math expressions unhighlighted in text blocks", () => {
    te = createEditor("\n∞∞∞text\ngraph TD\nx = 1 + 2\n");

    expect(highlightedTokens(te!.container)).toEqual([]);
  });
  it("edits a saved block with an unknown language named constructor", async () => {
    te = createEditor("\n∞∞∞constructor\nlegacy text\n∞∞∞text\nsecond");
    await userEvent.click(editorLines(te.container)[0]);
    await press("a", modKey);
    await userEvent.keyboard("updated");
    expect(visibleBlocks(te.container)).toEqual(["updated", "second"]);
  });

});
