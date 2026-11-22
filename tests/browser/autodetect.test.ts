import { afterEach, describe, expect, it } from "vitest";
import { applyDetectionResult } from "../../src/editor/language-detection/autodetect";
import { cleanup, createEditor, type TestEditor } from "./utils";

// language auto-detection results (docs/state-machines.md issue 15d)
describe("language auto-detection", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  const py = "def foo():\n    return 1\n";
  const js = "function foo() {\n  return 1;\n}\n";

  it("result is applied to the block it was requested for, not the active block", () => {
    te = createEditor("\n∞∞∞text-a\n" + py + "\n∞∞∞text-a\n" + js);
    const { editor } = te;
    // cursor in the second block
    editor.setCursorPosition(editor.getBlocks()[1]!.contentFrom);
    const ok = applyDetectionResult(editor.view, {
      guesslang: { language: "py", confidence: 1 },
      content: py,
    }, editor.getBlocks()[0]!.from);
    expect(ok).toBe(true);
    const blocks = editor.getBlocks();
    expect(blocks[0]!.language).toBe("python");
    expect(blocks[1]!.language).toBe("text");
  });

  it("result is ignored if the block's content changed significantly", () => {
    te = createEditor("\n∞∞∞text-a\n" + js);
    const ok = applyDetectionResult(te.editor.view, {
      guesslang: { language: "py", confidence: 1 },
      content: py,
    }, te.editor.getBlocks()[0]!.from);
    expect(ok).toBe(false);
    expect(te.editor.getBlocks()[0]!.language).toBe("text");
  });

  it("result is applied by block position, not index (U28)", () => {
    te = createEditor("\n∞∞∞text\nfirst\n∞∞∞text-a\n" + py);
    const view = te.editor.view;
    const target = te.editor.getBlocks()[1]!;
    // a block inserted before the target: the target's index changes
    view.dispatch({ changes: { from: 0, insert: "\n∞∞∞text-a\n" + py } });
    const mapped = target.from + ("\n∞∞∞text-a\n" + py).length;
    const ok = applyDetectionResult(view, { guesslang: { language: "py", confidence: 1 }, content: py }, mapped);
    expect(ok).toBe(true);
    const blocks = te.editor.getBlocks();
    expect(blocks[0]!.language).toBe("text");
    expect(blocks[2]!.language).toBe("python");
    // a position that isn't a block start: not applied
    expect(applyDetectionResult(view, { guesslang: { language: "py", confidence: 1 }, content: py }, mapped + 1)).toBe(false);
  });
});
