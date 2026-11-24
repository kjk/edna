import { openSearchPanel } from "@codemirror/search";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import { mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import Find from "../../src/components/Find.svelte";
import { MultiBlockEditor } from "../../src/editor/editor";

// find / replace limited to the current block or selection (#79)
describe("find scope", () => {
  let container: HTMLDivElement | undefined;
  let editor: MultiBlockEditor | undefined;

  afterEach(() => {
    editor?.destroy();
    container?.remove();
  });

  function createFindPanel(view: EditorView) {
    const dom = document.createElement("div");
    const comp = mount(Find, { target: dom, props: { view } });
    return {
      dom,
      top: true,
      update: (u: ViewUpdate) => comp.update(u),
      destroy: () => unmount(comp),
    };
  }

  const content = "\n∞∞∞text\nfoo foo\n∞∞∞text\nfoo foo";

  function setup(): EditorView {
    container = document.createElement("div");
    document.body.appendChild(container);
    editor = new MultiBlockEditor({
      element: container,
      save: async () => {},
      setIsDirty: () => {},
      createFindPanel,
      focus: true,
      useTabs: false,
      tabSize: 4,
    });
    editor.setContent(content);
    return editor.view;
  }

  function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
    el.value = value;
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }

  async function replaceAllIn(view: EditorView, scope: string) {
    openSearchPanel(view);
    const panel = container!.querySelector(".cm-panels")!;
    await expect.poll(() => panel.querySelector("input[placeholder='Find']")).not.toBeNull();
    (panel.querySelector("button[title='show replace']") as HTMLButtonElement).click();
    await expect.poll(() => panel.querySelector("input[placeholder='Replace']")).not.toBeNull();
    setValue(panel.querySelector("select.scope")!, scope);
    setValue(panel.querySelector("input[placeholder='Find']")!, "foo");
    setValue(panel.querySelector("input[placeholder='Replace']")!, "x");
    await new Promise((r) => setTimeout(r, 0));
    (panel.querySelector("button[title='replace all']") as HTMLButtonElement).click();
  }

  it("in note replaces everywhere", async () => {
    const view = setup();
    await replaceAllIn(view, "note");
    await expect.poll(() => editor!.getContent()).toBe("\n∞∞∞text\nx x\n∞∞∞text\nx x");
  });

  it("in block replaces only in the current block", async () => {
    const view = setup();
    view.dispatch({ selection: { anchor: content.indexOf("foo") } });
    await replaceAllIn(view, "block");
    await expect.poll(() => editor!.getContent()).toBe("\n∞∞∞text\nx x\n∞∞∞text\nfoo foo");
  });

  it("in selection replaces only in the selection", async () => {
    const view = setup();
    const b = content.lastIndexOf("foo foo");
    view.dispatch({ selection: { anchor: b + 2, head: content.length } });
    await replaceAllIn(view, "selection");
    await expect.poll(() => editor!.getContent()).toBe("\n∞∞∞text\nfoo foo\n∞∞∞text\nfoo x");
  });
});
