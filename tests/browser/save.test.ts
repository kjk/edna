import { afterEach, describe, expect, it } from "vitest";
import { MultiBlockEditor } from "../../src/editor/editor";

// tests for save bookkeeping: diskContent / dirty state (docs/state-machines.md M6)
describe("Editor save", () => {
  let container: HTMLDivElement | undefined;
  let editor: MultiBlockEditor | undefined;

  afterEach(() => {
    editor?.destroy();
    container?.remove();
  });

  function create(save: (content: string) => Promise<void>) {
    const state = { dirty: false };
    container = document.createElement("div");
    document.body.appendChild(container);
    editor = new MultiBlockEditor({
      element: container,
      save,
      setIsDirty: (d) => (state.dirty = d),
      createFindPanel: () => ({ dom: document.createElement("div"), update: () => {} }),
      focus: false,
      useTabs: false,
      tabSize: 4,
    });
    editor.setContent("\n∞∞∞text\nhello");
    return state;
  }

  function type(text: string) {
    const view = editor!.view;
    view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
  }

  it("failed save is retried by the next save", async () => {
    let fail = true;
    const saved: string[] = [];
    const state = create(async (c) => {
      if (fail) throw new Error("disk full");
      saved.push(c);
    });
    type("!");
    expect(state.dirty).toBe(true);
    await expect(editor!.save()).rejects.toThrow("disk full");
    expect(state.dirty).toBe(true);
    fail = false;
    await editor!.save();
    expect(saved).toEqual(["\n∞∞∞text\nhello!"]);
    expect(state.dirty).toBe(false);
  });

  it("stays dirty if edited while saving", async () => {
    let finishSave: () => void = () => {};
    const state = create(() => new Promise<void>((resolve) => (finishSave = resolve)));
    type("1");
    const p = editor!.save();
    type("2");
    finishSave();
    await p;
    expect(state.dirty).toBe(true);
    expect(editor!.diskContent).toBe("\n∞∞∞text\nhello1");
  });

  it("save of previous document doesn't affect newly loaded document", async () => {
    let finishSave: () => void = () => {};
    const state = create(() => new Promise<void>((resolve) => (finishSave = resolve)));
    type("1");
    const p = editor!.save();
    editor!.setContent("\n∞∞∞text\nother note");
    finishSave();
    await p;
    expect(editor!.diskContent).toBe("\n∞∞∞text\nother note");
    expect(state.dirty).toBe(false);
  });
});
