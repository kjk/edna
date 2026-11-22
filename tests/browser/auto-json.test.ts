import { afterEach, expect, it } from "vitest";
import { editorLines, pasteText, press } from "./editor-ui";
import { cleanup, createEditor, type TestEditor } from "./utils";

let te: TestEditor;
afterEach(() => cleanup(te));

it("highlights pasted JSON in an automatic block using the bundled worker", async () => {
  te = createEditor("\n∞∞∞text-a\n");
  await press("ArrowRight");
  pasteText(te.container, '{"ready": true}');
  const tokens = () => Array.from(editorLines(te.container)[0].querySelectorAll("span"), (span) => span.textContent);
  await expect.poll(tokens, { timeout: 3000 }).toContain('true');
});
