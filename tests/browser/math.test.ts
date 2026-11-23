import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { editorLines, modKey, press, visibleBlocks } from "./editor-ui";
import { cleanup, createEditor, setEditorHeight, type TestEditor } from "./utils";

describe("Math mode (browser tests)", () => {
  let te: TestEditor;

  beforeAll(async () => {
    // Load math.js library needed for math block evaluation
    await new Promise<void>((resolve, reject) => {
      if ((window as any).math) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "/math.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load math.js from /math.js"));
      document.head.appendChild(script);
    });
  });

  function getMathResults(): string[] {
    return Array.from(te.container.querySelectorAll(".edna-math-result .inner")).map((el) => el.textContent || "");
  }

  afterEach(() => {
    cleanup(te);
  });

  it("test math mode", async () => {
    te = createEditor("\n\u221E\u221E\u221Emath\n42*30+77\n");
    await expect.poll(() => getMathResults()).toContain("1337");
  });

  it("test math string result has no quotes", async () => {
    te = createEditor("\n\u221E\u221E\u221Emath\nformat(1/3, 3) \n");
    await expect.poll(() => getMathResults()).toContain("0.333");
  });

  it("custom format function", async () => {
    te = createEditor(
      '\n\u221E\u221E\u221Emath\n_format = format\nformat(x) = _format(x, {notation:"exponential"})\n42\n',
    );
    await expect
      .poll(() => {
        const results = getMathResults();
        return results[results.length - 1];
      })
      .toBe("4.2e+1");
  });

  it("previous result in prev variable", async () => {
    te = createEditor("\n\u221E\u221E\u221Emath\n128\nprev * 2 # 256\n");
    await expect
      .poll(() => {
        const results = getMathResults();
        return results[results.length - 1];
      })
      .toBe("256");
  });

  it("previous result in prev variable rows with invalid values", async () => {
    te = createEditor("\n\u221E\u221E\u221Emath\n1336\n23 /\n# comment\ntest\nprev+1#comment\nprev\n");
    await expect
      .poll(() => {
        const results = getMathResults();
        return results[results.length - 1];
      })
      .toBe("1337");
  });

  it("select all in math block replaces content", async () => {
    te = createEditor("\n∞∞∞math\n1\n2\n∞∞∞text\nKeep this block");
    await press("ArrowRight");
    // First Mod+A selects current block content
    await press("a", modKey);

    // Type to replace selected content
    await userEvent.keyboard("3");

    await expect.poll(() => getMathResults()).toEqual(["3"]);
    expect(visibleBlocks(te.container)).toEqual(["3", "Keep this block"]);
  });

  // Edna's fold keeps the first line visible (as a fold label) so its result is shown
  it("folded math block hides math results of folded lines", async () => {
    te = createEditor("\n\u221E\u221E\u221Emath\n1 + 1\n2 + 2\n\u221E\u221E\u221Etext\nAfter block\n");
    const { container } = te;

    // Wait for math results to appear
    await expect
      .poll(() => {
        return container.querySelectorAll(".edna-math-result").length;
      })
      .toBe(2);

    // Fold the math block
    await press("ArrowRight");
    await press(".", modKey, "Alt");

    await expect.poll(() => container.querySelectorAll(".cm-foldPlaceholder").length).toBeGreaterThan(0);

    await expect.poll(() => container.querySelectorAll(".edna-math-result").length).toBe(1);
  });

  it("variables defined above the viewport are used (U22)", async () => {
    const filler = Array(300).fill("1").join("\n");
    te = createEditor(`\n\u221E\u221E\u221Emath\nxyz = 21\n${filler}\nxyz * 2`);
    const scroller = setEditorHeight(te.container, 200);
    const definition = () => editorLines(te.container).find((line) => line.textContent?.includes("xyz = 21"));
    expect(definition()).toBeDefined();

    await press("ArrowRight");
    await press("ArrowDown", modKey);

    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(200);
    await expect.poll(definition).toBeUndefined();
    await expect.poll(() => getMathResults()).toContain("42");
  });
});
