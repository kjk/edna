import { afterEach, describe, expect, it } from "vitest";
import { rangeInFirstBlock } from "../../src/editor/block/block";
import { cleanup, createEditor, type TestEditor } from "./utils";

// functions run on a selection get only its part in the first block (#47)
describe("rangeInFirstBlock", () => {
  let te: TestEditor;
  const content = "\n∞∞∞text\nAAA\n∞∞∞text\nBBB";

  afterEach(() => {
    cleanup(te);
  });

  function check(from: number, to: number) {
    te = createEditor(content);
    let state = te.editor.view.state;
    let r = rangeInFirstBlock(state, from, to);
    return { text: state.sliceDoc(r.from, r.to), clipped: r.clipped };
  }

  const a = content.indexOf("AAA");
  const b = content.indexOf("BBB");

  it("selection within a block is unchanged", () => {
    expect(check(a, a + 2)).toEqual({ text: "AA", clipped: false });
  });

  it("selection spanning blocks is limited to the first block", () => {
    expect(check(a + 1, b + 2)).toEqual({ text: "AA", clipped: true });
  });

  it("selection starting in a block delimiter starts at the block's content", () => {
    expect(check(0, b + 3)).toEqual({ text: "AAA", clipped: true });
  });
});
