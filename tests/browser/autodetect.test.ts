import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { editorLines, modKey, pasteText, press, visibleBlocks } from "./editor-ui";
import { cleanup, createEditor, type TestEditor } from "./utils";

interface DetectionRequest {
  content: string;
  idx: number;
}

// Keep worker replies under test control so edits can happen while a request is pending.
class DetectionWorker {
  static instance: DetectionWorker;
  readonly requests: DetectionRequest[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor() {
    DetectionWorker.instance = this;
  }

  postMessage(request: DetectionRequest) {
    this.requests.push(request);
  }

  reply(request: DetectionRequest, language: string) {
    this.onmessage?.(
      new MessageEvent("message", {
        data: { ...request, guesslang: { language, confidence: 1 } },
      }),
    );
  }

  terminate() {}
}

describe("Language auto-detection", () => {
  let te: TestEditor | undefined;
  const py = "def foo():\n    return 1";
  const js = "function bar() {\n    return true;\n}";

  beforeEach(() => {
    vi.stubGlobal("Worker", DetectionWorker);
  });

  afterEach(() => {
    cleanup(te);
    te = undefined;
    vi.unstubAllGlobals();
  });

  async function requestFor(content: string) {
    const requests = DetectionWorker.instance.requests;
    await expect.poll(() => requests.find((request) => request.content === content)).toBeDefined();
    return requests.find((request) => request.content === content)!;
  }

  function highlightedTokens() {
    return editorLines(te!.container).flatMap((line) =>
      Array.from(
        line.querySelectorAll("span[class]:not(.cm-matchingBracket, .cm-nonmatchingBracket)"),
        (span) => span.textContent,
      ),
    );
  }

  it("highlights the requested block after the cursor moves to another block", async () => {
    te = createEditor("\n∞∞∞text-a\n\n∞∞∞text-a\nsecond block");
    await press("ArrowRight");
    pasteText(te.container, py);
    const request = await requestFor(py);

    await userEvent.click(editorLines(te.container).find((line) => line.textContent === "second block")!);
    expect(highlightedTokens()).toEqual([]);
    DetectionWorker.instance.reply(request, "py");

    await expect.poll(highlightedTokens).toContain("def");
    expect(visibleBlocks(te.container)).toEqual([py, "second block"]);
  });

  it("ignores a result for content that was replaced", async () => {
    te = createEditor("\n∞∞∞text-a\n");
    await press("ArrowRight");
    pasteText(te.container, py);
    const oldRequest = await requestFor(py);

    await press("a", modKey);
    pasteText(te.container, js);
    const newRequest = await requestFor(js);

    DetectionWorker.instance.reply(oldRequest, "py");
    expect(highlightedTokens()).toEqual([]);
    DetectionWorker.instance.reply(newRequest, "js");
    await expect.poll(highlightedTokens).toContain("function");
  });

  it("highlights the requested block after a new block is inserted before it", async () => {
    te = createEditor("\n∞∞∞text\nfirst\n∞∞∞text-a\n");
    await press("ArrowRight");
    await press("ArrowDown", modKey);
    await press("ArrowDown", modKey);
    pasteText(te.container, py);
    const request = await requestFor(py);

    await press("Enter", "Alt", "Shift");
    await userEvent.keyboard("new");
    expect(visibleBlocks(te.container)).toEqual(["new", "first", py]);
    expect(highlightedTokens()).toEqual([]);

    DetectionWorker.instance.reply(request, "py");
    await expect.poll(highlightedTokens).toContain("def");
    expect(visibleBlocks(te.container)).toEqual(["new", "first", py]);
  });
});
