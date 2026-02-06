import { expect } from "vitest";
import { MultiBlockEditor } from "../../src/editor/editor";

export interface TestEditor {
  editor: MultiBlockEditor;
  container: HTMLDivElement;
}

/**
 * Create a MultiBlockEditor for testing. Call cleanup() in afterEach to remove the container.
 */
export function createEditor(content: string): TestEditor {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const editor = new MultiBlockEditor({
    element: container,
    save: async () => {},
    setIsDirty: () => {},
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
 * Remove the editor container from the DOM.
 */
export function cleanup(te: TestEditor | undefined) {
  if (te?.container) {
    te.container.remove();
  }
}

/**
 * Get the text content of a block by index.
 */
export function getBlockContent(editor: MultiBlockEditor, blockIndex: number): string {
  const blocks = editor.getBlocks();
  const content = editor.getContent();
  expect(blocks.length).toBeGreaterThan(blockIndex);
  const block = blocks[blockIndex];
  return content.slice(block.contentFrom, block.to);
}
