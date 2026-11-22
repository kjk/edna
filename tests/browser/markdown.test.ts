import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { createEditor, cleanup, getBlockContent, type TestEditor } from "./utils";

describe("Markdown (browser tests)", () => {
  let te: TestEditor;

  afterEach(() => {
    cleanup(te);
  });

  it("checkbox toggle", async () => {
    te = createEditor("\n\u221E\u221E\u221Emarkdown\n- [ ] todo\n");
    const { editor, container } = te;

    // Wait for checkbox to be rendered by the decorator plugin
    await expect
      .poll(() => container.querySelectorAll(".cm-content input[type=checkbox]").length)
      .toBe(1);

    const checkbox = () => container.querySelector<HTMLInputElement>(".cm-content input[type=checkbox]")!;

    // Check → [x] (the plugin's mousedown handler toggles the text)
    await userEvent.click(checkbox());
    await expect.poll(() => getBlockContent(editor, 0)).toBe("- [x] todo\n");
    await expect.poll(() => checkbox().checked).toBe(true);

    // Uncheck → [ ]
    await userEvent.click(checkbox());
    await expect.poll(() => getBlockContent(editor, 0)).toBe("- [ ] todo\n");
    await expect.poll(() => checkbox().checked).toBe(false);
  });

  it("todo list continue on enter", async () => {
    const content = "\n\u221E\u221E\u221Emarkdown\n- [ ] todo";
    te = createEditor(content);
    const { editor } = te;

    editor.setCursorPosition(editor.getContent().length);
    editor.view.focus();

    await userEvent.keyboard("{Enter}");
    expect(getBlockContent(editor, 0)).toBe("- [ ] todo\n- [ ] ");
  });

  // Note: "test markdown mode" is skipped because it checks Edna's status bar UI
  // Note: "toggle checkbox command" tests are skipped because Edna doesn't have
  // a toggleCheckbox command — checkboxes can only be toggled by clicking them
});
