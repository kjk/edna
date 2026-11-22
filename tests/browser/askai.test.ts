import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AskAI from "../../src/components/AskAI.svelte";
import { getSettings } from "../../src/settings.svelte";

// Ask AI request lifecycle (docs/state-machines.md M10, issue 12)
describe("Ask AI", () => {
  let comp: ReturnType<typeof mount> | undefined;
  let target: HTMLElement | undefined;
  const realFetch = window.fetch;

  afterEach(() => {
    window.fetch = realFetch;
    if (comp) unmount(comp);
    comp = undefined;
    target?.remove();
  });

  // fetch that streams `chunks` and then (if !end) waits until aborted
  function fakeFetch(chunks: string[], end: boolean) {
    const signals: AbortSignal[] = [];
    window.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const signal = init!.signal!;
      signals.push(signal);
      const enc = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          for (const c of chunks) controller.enqueue(enc.encode(c));
          if (end) controller.close();
          signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    return signals;
  }

  function setup(insertResponse: (s: string) => boolean) {
    const settings = getSettings();
    settings.openRouterKey = "sk-or-" + "x".repeat(60);
    target = document.createElement("div");
    document.body.appendChild(target);
    const closed = { v: false };
    comp = mount(AskAI, {
      target,
      props: { close: () => (closed.v = true), startText: "question", insertResponse },
    });
    flushSync();
    return closed;
  }

  function button(text: string): HTMLButtonElement {
    return Array.from(target!.querySelectorAll("button")).find((b) => b.textContent?.includes(text))!;
  }

  const data = (s: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: s } }] })}\n`;

  it("closing the dialog aborts the request", async () => {
    const signals = fakeFetch([data("partial")], false);
    setup(() => true);
    button("Ask AI").click();
    await expect.poll(() => signals.length).toBe(1);
    unmount(comp!);
    comp = undefined;
    expect(signals[0]!.aborted).toBe(true);
  });

  it("response split across chunks is not lost; read-only note keeps the dialog open", async () => {
    const line = data("hello world");
    fakeFetch([line.slice(0, 20), line.slice(20), "data: [DONE]\n"], true);
    let inserted = "";
    const closed = setup((s) => {
      inserted = s;
      return false; // read-only note
    });
    button("Ask AI").click();
    await expect.poll(() => target!.textContent).toContain("hello world");
    button("Insert response").click();
    flushSync();
    expect(inserted).toContain("hello world");
    expect(closed.v).toBe(false);
    expect(target!.textContent).toContain("read-only");
  });
});
