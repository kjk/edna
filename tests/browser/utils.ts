import { mount, unmount } from "svelte";
import { expect } from "vitest";
import { MultiBlockEditor } from "../../src/editor/editor";

export interface TestEditor {
  editor: MultiBlockEditor;
  container: HTMLDivElement;
}

/**
 * Create a MultiBlockEditor for testing. Call cleanup() in afterEach to remove the container.
 */
export function createEditor(
  content: string,
  opts: {
    save?: (content: string) => Promise<void>;
    setIsDirty?: (dirty: boolean) => void;
  } = {},
): TestEditor {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const editor = new MultiBlockEditor({
    element: container,
    save: opts.save ?? (async () => {}),
    setIsDirty: opts.setIsDirty ?? (() => {}),
    createFindPanel: () => ({ dom: document.createElement("div"), update: () => {} }),
    focus: true,
    useTabs: false,
    tabSize: 4,
  });

  editor.setContent(content);
  editor.view.focus();

  return { editor, container };
}

// waits until get() returns a value (not null / undefined) and returns it
export async function waitForValue<T>(get: () => T | null | undefined): Promise<T> {
  await expect.poll(get).not.toBeNullable();
  return get()!;
}

// sets height of the editor in container; returns its scrolling element
export function setEditorHeight(container: HTMLElement, height: number): HTMLElement {
  container.querySelector<HTMLElement>(".cm-editor")!.style.height = `${height}px`;
  return container.querySelector<HTMLElement>(".cm-scroller")!;
}

// mounts component into a new <div> added to the page (style: css of the div)
export function mountInNewDiv(
  component: any,
  props: Record<string, unknown> = {},
  style = "",
): { target: HTMLDivElement; comp: ReturnType<typeof mount> } {
  const target = document.createElement("div");
  target.style.cssText = style;
  document.body.appendChild(target);
  return { target, comp: mount(component, { target, props }) };
}

// undoes mountInNewDiv(); either can be undefined (e.g. already unmounted)
export async function unmountAndRemove(target?: HTMLElement, comp?: ReturnType<typeof mount>) {
  if (comp) {
    await unmount(comp);
  }
  target?.remove();
}

/**
 * Destroy the editor and remove its container from the DOM.
 */
export function cleanup(te: TestEditor | undefined) {
  te?.editor.destroy();
  te?.container.remove();
}
