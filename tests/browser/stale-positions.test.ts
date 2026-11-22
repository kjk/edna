import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, createEditor, type TestEditor } from "./utils";
import { visibleBlocks } from "./editor-ui";

let te: TestEditor;
afterEach(() => cleanup(te));

const doc = "\n∞∞∞text\nline 1\nline 2\n∞∞∞markdown\nm1\nm2\nm3";
const firstEnd = doc.indexOf("\n∞∞∞markdown");
const secondContent = doc.indexOf("m1");

// Stale offsets arrive through the note-loading API. Observe what users can see and edit.
it("restores the fold that still fits and leaves other lines visible", async () => {
  te = createEditor(doc);
  te.editor.setFoldedRanges([
    { from: 0, to: 5 },
    { from: 10, to: 10000 },
    { from: firstEnd - 2, to: secondContent + 1 },
    { from: secondContent + 2, to: doc.length },
  ]);
  const placeholders = te.container.querySelectorAll<HTMLElement>(".cm-foldPlaceholder");
  expect(placeholders).toHaveLength(1);
  expect(placeholders[0].textContent).toContain("3 lines");
  expect(visibleBlocks(te.container)).toEqual(["line 1\nline 2", "m1"]);
  await userEvent.click(placeholders[0]);
  expect(visibleBlocks(te.container)).toEqual(["line 1\nline 2", "m1\nm2\nm3"]);
});

it.each([
  { name: "inside a hidden delimiter", anchor: firstEnd + 4, head: firstEnd + 12, expected: ["line 1\nline 2", "xm1\nm2\nm3"] },
  { name: "at the preceding block's end", anchor: firstEnd, head: firstEnd, expected: ["line 1\nline 2x", "m1\nm2\nm3"] },
  { name: "from the first delimiter through the last block", anchor: 3, head: doc.length, expected: ["x"] },
])("can type after restoring a selection $name", async ({ anchor, head, expected }) => {
  te = createEditor(doc);
  te.editor.setSelection({ ranges: [{ anchor, head }], main: 0 });
  await userEvent.keyboard("x");
  expect(visibleBlocks(te.container)).toEqual(expected);
});
