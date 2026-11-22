import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { modKey, pasteText, press, visibleBlocks } from "./editor-ui";
import { cleanup, createEditor, type TestEditor } from "./utils";

describe("Clipboard", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  function blocks() {
    return visibleBlocks(te!.container);
  }

  async function cut() {
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    try {
      await press("x", modKey);
      expect(write).toHaveBeenCalledTimes(1);
      return write.mock.calls[0][0];
    } finally {
      write.mockRestore();
    }
  }

  it("cut with empty selection removes the current line", async () => {
    te = createEditor("\n∞∞∞text\nline 1\nline 2\nline 3");
    await userEvent.keyboard("{ArrowRight}{ArrowDown}{ArrowRight}{ArrowRight}");

    expect(await cut()).toBe("line 2");
    expect(blocks()).toEqual(["line 1\nline 3"]);
  });

  it("cut with selection removes only the selection", async () => {
    te = createEditor("\n∞∞∞text\nline 1\nline 2");
    await userEvent.keyboard("{ArrowRight}{ArrowDown}{Home}{Shift>}{ArrowRight>4/}{/Shift}");

    expect(await cut()).toBe("line");
    expect(blocks()).toEqual(["line 1\n 2"]);
  });

  // Cutting the last line of a block keeps the next block's delimiter intact (U10).
  it.each([
    { before: "only", kept: "", keys: "{ArrowRight}", removed: "only" },
    { before: "a\nlast", kept: "a", keys: "{ArrowRight}{ArrowDown}", removed: "last" },
    { before: "", kept: "", keys: "{ArrowRight}", removed: "" },
  ])("cut before a block boundary preserves both blocks ($before)", async ({ before, kept, keys, removed }) => {
    te = createEditor(`\n∞∞∞text\n${before}\n∞∞∞markdown\nx`);
    await userEvent.keyboard(keys);

    expect(await cut()).toBe(removed);
    expect(blocks()).toEqual([kept, "x"]);
  });

  // Pasted text doesn't create blocks (U27).
  it.each([
    { input: "a\n∞∞∞js\nb", expected: ["a", "", "b"] },
    { input: "∞∞∞text-a\nb", expected: ["", "b"] },
    { input: "a\n∞∞∞Text\nb", expected: ["a", "∞∞∞Text", "b"] },
    { input: "plain", expected: ["plain"] },
    { input: "∞∞∞js", expected: [""] },
  ])("pasting $input on an empty line preserves text and strips delimiters", async ({ input, expected }) => {
    te = createEditor("\n∞∞∞text\n");
    await userEvent.keyboard("{ArrowRight}");

    pasteText(te.container, input);

    expect(blocks()).toEqual([expected.join("\n")]);
  });

  it("pasting a note's raw text doesn't add blocks", async () => {
    te = createEditor("\n∞∞∞text\nhello\n");
    await userEvent.keyboard("{ArrowRight}{ArrowDown}");

    pasteText(te.container, "\n∞∞∞js\nlet x\n∞∞∞markdown\n# hi");

    expect(blocks()).toEqual(["hello\n\n\nlet x\n\n# hi"]);
  });

  it.each([
    { input: "∞∞∞markdown", keys: "{ArrowRight}{ArrowRight}", expected: ["a∞∞∞markdownb"] },
    { input: "∞∞∞js", keys: "{ArrowRight}", expected: ["∞∞∞jsab"] },
    {
      input: "∞∞∞js\na\n∞∞∞md\nb\n∞∞∞py",
      keys: "{ArrowRight}{ArrowRight}",
      expected: ["a∞∞∞js", "a", "", "b", "∞∞∞pyb"],
    },
  ])("pasting $input next to existing text preserves partial delimiter lines", async ({ input, keys, expected }) => {
    te = createEditor("\n∞∞∞text\nab");
    await userEvent.keyboard(keys);

    pasteText(te.container, input);

    expect(blocks()).toEqual([expected.join("\n")]);
  });
});
