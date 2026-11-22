import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { cleanup, createEditor, type TestEditor } from "./utils";
import { editorLines, modKey, press, visibleBlocks } from "./editor-ui";

let te: TestEditor;
afterEach(() => cleanup(te));

it("selects an empty block first and replaces the whole note on the second Select All", async () => {
  te = createEditor("\n∞∞∞text\n\n∞∞∞text\nsecond");
  await press("a", modKey);
  expect(te.container.querySelector(".heynote-empty-block-selected")).toBeTruthy();
  await press("a", modKey);
  await userEvent.keyboard("replacement");
  expect(visibleBlocks(te.container)).toEqual(["replacement"]);
});

it("moves a line across a block boundary and undoes the move", async () => {
  te = createEditor("\n∞∞∞text\nalpha\nbeta\n∞∞∞text\ngamma");
  await userEvent.click(editorLines(te.container)[1]);
  await press("ArrowDown", "Alt");
  expect(visibleBlocks(te.container)).toEqual(["alpha", "beta\ngamma"]);
  await press("z", modKey);
  expect(visibleBlocks(te.container)).toEqual(["alpha\nbeta", "gamma"]);
});

it("Emacs mark extends movement and transpose swaps neighboring characters", async () => {
  te = createEditor("\n∞∞∞text\nabc\n∞∞∞text\nxyz");
  await userEvent.click(editorLines(te.container)[0]);
  te.editor.setKeymap("emacs", "alt");
  await press("a", "Control");
  await press("f", "Control");
  await press("t", "Control");
  expect(visibleBlocks(te.container)).toEqual(["bac", "xyz"]);
  await press("a", "Control");
  await press("Space", "Control");
  await press("f", "Control");
  await press("f", "Control");
  await userEvent.keyboard("X");
  expect(visibleBlocks(te.container)).toEqual(["Xc", "xyz"]);
  await press("g", "Control");
});

it("marks complete web links and updates the link as text is edited", async () => {
  te = createEditor("\n∞∞∞text\n(https://example.com/test) plain");
  const link = () => te.container.querySelector<HTMLElement>(".heynote-link");
  await expect.poll(() => link()?.textContent).toBe("https://example.com/test");
  expect(link()?.title).toMatch(/click/i);
  await userEvent.click(editorLines(te.container)[0]);
  await press("a", modKey);
  await userEvent.keyboard("plain text");
  await expect.poll(link).toBeNull();
});
