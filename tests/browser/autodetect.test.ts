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
      idx: 0,
    });
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
      idx: 0,
    });
    expect(ok).toBe(false);
    expect(te.editor.getBlocks()[0]!.language).toBe("text");
  });
});
