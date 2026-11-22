import { ensureSyntaxTree } from "@codemirror/language";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Languages", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  // returns name of the innermost syntax node at pos (inside nested language parsers)
  function nodeAt(pos: number): string {
    const state = te!.editor.view.state;
    const tree = ensureSyntaxTree(state, state.doc.length, 5000)!;
    return tree.resolveInner(pos, 1).name;
  }

  it("mermaid blocks are parsed with mermaid parser", () => {
    const content = "\n∞∞∞mermaid\ngraph TD\n  A --> B\n";
    te = createEditor(content);
    const pos = content.indexOf("graph");
    expect(nodeAt(pos)).not.toBe("NoteContent");
  });

  it("text blocks have no nested parser", () => {
    const content = "\n∞∞∞text\ngraph TD\n";
    te = createEditor(content);
    expect(nodeAt(content.indexOf("graph"))).toBe("NoteContent");
  });
});
