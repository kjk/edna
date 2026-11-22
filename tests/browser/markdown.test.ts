import { describe, expect, it, afterEach } from "vitest";
import { userEvent } from "vitest/browser";
import { toggleCheckbox } from "../../src/editor/todo-checkbox";
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

  it("toggle checkbox command", async () => {
    const content = "\n\u221E\u221E\u221Emarkdown\n- [ ] todo\n";
    te = createEditor(content);
    const { editor } = te;
    editor.setCursorPosition(content.indexOf("- [ ] todo") + "- [ ] ".length);
    toggleCheckbox(editor.view);
    expect(getBlockContent(editor, 0)).toBe("- [x] todo\n");
    // also bound to Mod-Shift-Space
    const modKey = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modKey}>}{Shift>}{ }{/Shift}{/${modKey}}`);
    expect(getBlockContent(editor, 0)).toBe("- [ ] todo\n");
  });

  it("toggle checkbox command with selection sets all to the same state", () => {
    const content = "\n\u221E\u221E\u221Emarkdown\n- [ ] one\n- [x] two\n- [x] three\n- note\n";
    te = createEditor(content);
    const { editor } = te;
    const from = content.indexOf("- [ ] one");
    const to = content.indexOf("- [x] three") + "- [x] three".length;
    editor.view.dispatch({ selection: { anchor: from, head: to } });
    toggleCheckbox(editor.view);
    // most were checked so all get unchecked
    expect(getBlockContent(editor, 0)).toBe("- [ ] one\n- [ ] two\n- [ ] three\n- note\n");
  });

  it("toggle checkbox command only changes markdown blocks", () => {
    const content = "\n\u221E\u221E\u221Emarkdown\n- [x] one\n- [x] two\n\u221E\u221E\u221Etext\n- [x] three\n- [ ] four\n";
    te = createEditor(content);
    const { editor } = te;
    const from = content.indexOf("- [x] one");
    const to = content.indexOf("- [ ] four") + "- [ ] four".length;
    editor.view.dispatch({ selection: { anchor: from, head: to } });
    toggleCheckbox(editor.view);
    expect(getBlockContent(editor, 0)).toBe("- [ ] one\n- [ ] two");
    expect(getBlockContent(editor, 1)).toBe("- [x] three\n- [ ] four\n");
  });
});
