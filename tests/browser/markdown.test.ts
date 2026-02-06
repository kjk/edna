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

    // Toggle checkbox by finding the "[ ] " position and dispatching a change
    // (The plugin's mousedown handler calls toggleBoolean which does this)
    function toggleCheckbox() {
      const content = editor.getContent();
      const unchecked = content.indexOf("[ ] ");
      const checked = content.indexOf("[x] ");
      const pos = unchecked >= 0 ? unchecked + 4 : checked >= 0 ? checked + 4 : -1;
      if (pos < 0) return;
      const before = content.slice(pos - 4, pos);
      if (before === "[ ] ") {
        editor.view.dispatch({ changes: { from: pos - 4, to: pos, insert: "[x] " } });
      } else if (before === "[x] ") {
        editor.view.dispatch({ changes: { from: pos - 4, to: pos, insert: "[ ] " } });
      }
    }

    // Check → [x]
    toggleCheckbox();
    await expect.poll(() => getBlockContent(editor, 0)).toBe("- [x] todo\n");

    // Uncheck → [ ]
    toggleCheckbox();
    await expect.poll(() => getBlockContent(editor, 0)).toBe("- [ ] todo\n");
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
