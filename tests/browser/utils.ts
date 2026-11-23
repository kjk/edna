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

/**
 * Destroy the editor and remove its container from the DOM.
 */
export function cleanup(te: TestEditor | undefined) {
  te?.editor.destroy();
  te?.container.remove();
}
