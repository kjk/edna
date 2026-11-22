import { afterEach, describe, expect, it } from "vitest";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Color preview", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  function swatches(): string[] {
    return Array.from(te!.container.querySelectorAll<HTMLElement>(".edna-color-preview")).map((e) => e.title);
  }

  it("shows swatches for valid colors in css blocks", async () => {
    te = createEditor("\n∞∞∞css\na { color: #f00; background: rgb(0, 128, 0); border-color: hsl(0 0% 50%); }\n");
    await expect.poll(() => swatches()).toEqual(["#f00", "rgb(0, 128, 0)", "hsl(0 0% 50%)"]);
  });

  it("ignores invalid colors and ids", async () => {
    te = createEditor("\n∞∞∞javascript\nlet a = '#12'; let b = 'x#fff'; let c = '#ggg'; let d = '#abc';\n");
    await expect.poll(() => swatches()).toEqual(["#abc"]);
  });

  it("no swatches in text blocks", async () => {
    te = createEditor("\n∞∞∞text\ncolor #f00\n");
    // give the plugin a chance to run
    await expect.poll(() => te!.container.querySelectorAll(".cm-line").length).toBeGreaterThan(0);
    expect(swatches()).toEqual([]);
  });

  it("can be turned off", async () => {
    te = createEditor("\n∞∞∞css\na { color: #f00; }\n");
    await expect.poll(() => swatches().length).toBe(1);
    te.editor.setColorPreview(false);
    await expect.poll(() => swatches().length).toBe(0);
  });
});
