import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { MultiBlockEditor } from "../../src/editor/editor";
import { modKey, press } from "./editor-ui";

// Tests observe the storage callback and the dirty indicator at the editor's
// integration boundary. Saving explicitly lets each test control the in-flight write.
describe("Editor save", () => {
  let container: HTMLDivElement | undefined;
  let editor: MultiBlockEditor;
  const hello = "\n∞∞∞text\nhello";
  const other = "\n∞∞∞text\nother note";

  afterEach(() => {
    editor?.destroy();
    container?.remove();
  });

  async function create(save: (content: string) => Promise<void>) {
    const state = { dirty: false };
    container = document.createElement("div");
    document.body.appendChild(container);
    editor = new MultiBlockEditor({
      element: container,
      save,
      setIsDirty: (dirty) => (state.dirty = dirty),
      createFindPanel: () => ({ dom: document.createElement("div"), update: () => {} }),
      focus: true,
      useTabs: false,
      tabSize: 4,
    });
    editor.setContent(hello);
    await press("ArrowRight");
    await press("ArrowDown", modKey);
    return state;
  }

  it("failed save is retried by the next save", async () => {
    const save = vi
      .fn<(content: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue(undefined);
    const state = await create(save);
    await userEvent.keyboard("!");

    expect(state.dirty).toBe(true);
    await expect(editor.save()).rejects.toThrow("disk full");
    expect(state.dirty).toBe(true);

    await editor.save();

    expect(save.mock.calls).toEqual([[hello + "!"], [hello + "!"]]);
    expect(state.dirty).toBe(false);
  });

  it("stays dirty if edited while saving", async () => {
    const write = Promise.withResolvers<void>();
    const save = vi
      .fn<(content: string) => Promise<void>>()
      .mockReturnValueOnce(write.promise)
      .mockResolvedValue(undefined);
    const state = await create(save);
    await userEvent.keyboard("1");
    const pending = editor.save();

    await userEvent.keyboard("2");
    write.resolve();
    await pending;

    expect(state.dirty).toBe(true);
    await editor.save();
    expect(save.mock.calls).toEqual([[hello + "1"], [hello + "12"]]);
    expect(state.dirty).toBe(false);
  });

  it("save of previous document doesn't affect newly loaded document", async () => {
    const write = Promise.withResolvers<void>();
    const save = vi
      .fn<(content: string) => Promise<void>>()
      .mockReturnValueOnce(write.promise)
      .mockResolvedValue(undefined);
    const state = await create(save);
    await userEvent.keyboard("1");
    const pending = editor.save();

    editor.setContent(other);
    write.resolve();
    await pending;
    await editor.save();

    expect(save.mock.calls).toEqual([[hello + "1"]]);
    expect(state.dirty).toBe(false);
  });
});
