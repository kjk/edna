import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { copyText, editorLines, modKey, press, visibleBlocks } from "./editor-ui";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Markdown", () => {
  let te: TestEditor;

  afterEach(() => {
    cleanup(te);
  });

  function boxes() {
    return [...te.container.querySelectorAll<HTMLInputElement>(".cm-content input[type=checkbox]")];
  }

  function checked() {
    return boxes().map((checkbox) => checkbox.checked);
  }

  async function copyBlock() {
    await press("a", modKey);
    return copyText(te.container);
  }

  function toggleWithShortcut() {
    return press(" ", modKey, "Shift");
  }

  it("clicking a task checkbox toggles its state", async () => {
    te = createEditor("\n∞∞∞markdown\n- [ ] todo\n");
    await expect.poll(checked).toEqual([false]);

    await userEvent.click(boxes()[0]!);
    await expect.poll(checked).toEqual([true]);
    expect(await copyBlock()).toBe("- [x] todo\n");

    await userEvent.click(boxes()[0]!);
    await expect.poll(checked).toEqual([false]);
    expect(await copyBlock()).toBe("- [ ] todo\n");
  });

  it("pressing a checkbox doesn't change a read-only note", async () => {
    te = createEditor("\n∞∞∞markdown\n- [ ] todo\n");
    te.editor.setReadOnly(true);
    await expect.poll(checked).toEqual([false]);

    boxes()[0]!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    expect(checked()).toEqual([false]);
    expect(await copyBlock()).toBe("- [ ] todo\n");
  });

  it("continues a task list when Enter is pressed", async () => {
    te = createEditor("\n∞∞∞markdown\n- [ ] todo");
    await press("ArrowRight");
    await press("ArrowDown", modKey);

    await press("Enter");
    await userEvent.keyboard("next");

    await expect.poll(checked).toEqual([false, false]);
    expect(editorLines(te.container).map((line) => line.textContent?.trim().split(/\s+/).at(-1))).toEqual([
      "todo",
      "next",
    ]);
  });

  it("Mod-Shift-Space toggles the checkbox on the current line", async () => {
    te = createEditor("\n∞∞∞markdown\n- [ ] todo\n");
    await press("ArrowRight");

    await toggleWithShortcut();
    await expect.poll(checked).toEqual([true]);

    await toggleWithShortcut();
    await expect.poll(checked).toEqual([false]);
  });

  it("toggling with a selection sets all checkboxes to the same state", async () => {
    te = createEditor("\n∞∞∞markdown\n- [ ] one\n- [x] two\n- [x] three\n- note\n");
    await expect.poll(checked).toEqual([false, true, true]);
    await press("ArrowRight");
    await userEvent.keyboard("{Shift>}{ArrowDown>3/}{/Shift}");

    await toggleWithShortcut();

    expect(checked()).toEqual([false, false, false]);
    expect(editorLines(te.container)[3]?.textContent).toBe("- note");
  });

  it("toggling across blocks only changes markdown checkboxes", async () => {
    te = createEditor("\n∞∞∞markdown\n- [x] one\n- [x] two\n∞∞∞text\n- [x] three\n- [ ] four\n");
    await expect.poll(checked).toEqual([true, true]);
    await press("ArrowRight");
    await press("a", modKey);
    await press("a", modKey);

    await toggleWithShortcut();

    expect(checked()).toEqual([false, false]);
    expect(visibleBlocks(te.container)[1]).toBe("- [x] three\n- [ ] four\n");
  });
});
