import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { editorLines, modKey, press } from "./editor-ui";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Scroll margin", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  function constrainEditorHeight(height: number) {
    te!.container.querySelector<HTMLElement>(".cm-editor")!.style.height = `${height}px`;
    return te!.container.querySelector<HTMLElement>(".cm-scroller")!;
  }

  it.each([
    { line: "First line 8", margin: 5 },
    { line: "Last line 1", margin: 0 },
    { line: "Last line 3", margin: 2 },
    { line: "Last line 7", margin: 5 },
  ])("keeps $margin lines above the cursor at $line", async ({ line, margin }) => {
    const makeLines = (prefix: string) => Array.from({ length: 24 }, (_, i) => `${prefix} line ${i + 1}`).join("\n");
    te = createEditor(`\n∞∞∞text\n${makeLines("First")}\n∞∞∞text\n${makeLines("Last")}`);
    const scroller = constrainEditorHeight(260);
    const target = editorLines(te.container).find((element) => element.textContent === line)!;
    await userEvent.click(target, { position: { x: 20, y: 5 } });

    const distanceFromTop = () => target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    const lineHeight = target.getBoundingClientRect().height;
    scroller.scrollTop += distanceFromTop() + 5;
    await press("ArrowRight");

    await expect.poll(() => Math.round(distanceFromTop() / lineHeight)).toBe(margin);
  });

  it("Mod-Shift-Enter scrolls down and focuses a new block at the end", async () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    te = createEditor("\n∞∞∞text\n" + lines.join("\n"));
    const scroller = constrainEditorHeight(200);
    await press("ArrowRight");
    expect(scroller.scrollTop).toBeLessThan(100);

    await press("Enter", modKey, "Shift");
    await userEvent.keyboard("new block");

    await expect.poll(() => scroller.scrollTop).toBeGreaterThan(500);
    const rendered = editorLines(te.container);
    expect(rendered.slice(-2).map((line) => line.textContent)).toEqual(["line 49", "new block"]);
    expect(rendered.at(-1)?.previousElementSibling?.classList.contains("edna-block-start")).toBe(true);
  });
});
