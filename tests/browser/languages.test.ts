import { afterEach, describe, expect, it } from "vitest";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Languages", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  function highlightedTokens() {
    return Array.from(te!.container.querySelectorAll(".cm-line span[class]"), (span) => span.textContent);
  }

  it("highlights Mermaid diagram syntax", async () => {
    te = createEditor("\n∞∞∞mermaid\ngraph TD\n  A --> B\n");

    await expect.poll(highlightedTokens).toContain("graph");
  });

  it("highlights numbers in math expressions", async () => {
    te = createEditor("\n∞∞∞math\nx = 1 + 2\n");

    await expect.poll(highlightedTokens).toContain("2");
  });

  it("leaves diagram syntax and math expressions unhighlighted in text blocks", () => {
    te = createEditor("\n∞∞∞text\ngraph TD\nx = 1 + 2\n");

    expect(highlightedTokens()).toEqual([]);
  });
});
