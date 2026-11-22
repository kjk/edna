import { flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { kModelsCacheKey } from "../../src/ai-models";
import AskAI from "../../src/components/AskAI.svelte";
import { getSettings } from "../../src/settings.svelte";

const keys = {
  openAIKey: "sk-proj-" + "x".repeat(60),
  anthropicKey: "sk-ant-" + "y".repeat(60),
  openRouterKey: "sk-or-v1-" + "z".repeat(60),
};

// lists of models returned by /api/ai/models
const modelLists: Record<string, unknown> = {
  openai: { data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] },
  anthropic: { data: [{ id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" }] },
  openrouter: { data: [{ id: "openai/gpt-4o", name: "OpenAI: GPT-4o", pricing: { prompt: "0", completion: "0" } }] },
};

// Ask AI request lifecycle (docs/state-machines.md M10, issue 12) and models
// downloaded from providers
describe("Ask AI", () => {
  let comp: ReturnType<typeof mount> | undefined;
  let target: HTMLElement | undefined;
  const realFetch = window.fetch;
  const settings = getSettings();
  const saved = { ...settings };

  afterEach(() => {
    window.fetch = realFetch;
    if (comp) unmount(comp);
    comp = undefined;
    target?.remove();
    Object.assign(settings, saved);
    localStorage.removeItem(kModelsCacheKey);
  });

  interface ChatCall {
    url: string;
    model: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  }

  // serves lists of models; chat requests stream `chunks` and then (if !end)
  // wait until aborted
  function fakeFetch(chunks: string[], end: boolean, opts: { status?: Record<string, number> } = {}) {
    const chat: ChatCall[] = [];
    const modelRequests: string[] = [];
    window.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.startsWith("/api/ai/models")) {
        const provider = new URL(u, location.href).searchParams.get("provider")!;
        modelRequests.push(provider);
        const status = opts.status?.[provider] ?? 200;
        return new Response(JSON.stringify(status === 200 ? modelLists[provider] : { error: "bad key" }), { status });
      }
      if (!u.includes("/chat/completions")) {
        // e.g. usage logging
        return new Response("{}", { status: 200 });
      }
      const signal = init!.signal!;
      chat.push({ url: u, model: JSON.parse(init!.body as string).model, headers: init!.headers as Record<string, string>, signal });
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
    return { chat, modelRequests };
  }

  function setup(insertResponse: (s: string) => boolean, s: Partial<typeof settings> = {}) {
    localStorage.removeItem(kModelsCacheKey);
    Object.assign(settings, { openAIKey: "", anthropicKey: "", xAIKey: "", openRouterKey: keys.openRouterKey, aiModelID: "" }, s);
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

  // models are loaded and a model is selected
  async function ready() {
    await expect.poll(() => button("Ask AI").disabled).toBe(false);
  }

  const data = (s: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: s } }] })}\n`;

  it("closing the dialog aborts the request", async () => {
    const { chat } = fakeFetch([data("partial")], false);
    setup(() => true);
    await ready();
    button("Ask AI").click();
    await expect.poll(() => chat.length).toBe(1);
    unmount(comp!);
    comp = undefined;
    expect(chat[0]!.signal.aborted).toBe(true);
  });

  it("response split across chunks is not lost; read-only note keeps the dialog open", async () => {
    const line = data("hello world");
    fakeFetch([line.slice(0, 20), line.slice(20), "data: [DONE]\n"], true);
    let inserted = "";
    const closed = setup((s) => {
      inserted = s;
      return false; // read-only note
    });
    await ready();
    button("Ask AI").click();
    await expect.poll(() => target!.textContent).toContain("hello world");
    button("Insert response").click();
    flushSync();
    expect(inserted).toContain("hello world");
    expect(closed.v).toBe(false);
    expect(target!.textContent).toContain("read-only");
  });

  it("models are downloaded only for providers with a key; an old model id becomes the closest model", async () => {
    const { chat, modelRequests } = fakeFetch([data("hi"), "data: [DONE]\n"], true);
    // "gpt-4o" is an id from before models were downloaded (no provider)
    setup(() => true, { openAIKey: keys.openAIKey, aiModelID: "gpt-4o", starredModels: ["gpt-4o"] });
    await ready();
    expect(modelRequests.sort()).toEqual(["openai", "openrouter"]);
    expect(settings.aiModelID).toBe("openai/gpt-4o");
    expect(settings.starredModels).toEqual(["openai/gpt-4o"]);
    button("Ask AI").click();
    await expect.poll(() => chat.length).toBe(1);
    expect(chat[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(chat[0]!.model).toBe("gpt-4o");
    expect(chat[0]!.headers.Authorization).toBe("Bearer " + keys.openAIKey);
  });

  it("OpenRouter and Anthropic models are sent to their provider", async () => {
    const { chat } = fakeFetch([data("hi"), "data: [DONE]\n"], true);
    setup(() => true, { anthropicKey: keys.anthropicKey, aiModelID: "anthropic/claude-sonnet-4-5" });
    await ready();
    button("Ask AI").click();
    await expect.poll(() => chat.length).toBe(1);
    expect(chat[0]!.url).toBe("https://api.anthropic.com/v1/chat/completions");
    expect(chat[0]!.model).toBe("claude-sonnet-4-5");
    expect(chat[0]!.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");

    settings.aiModelID = "openrouter/openai/gpt-4o";
    await expect.poll(() => target!.textContent).toContain("OpenAI: GPT-4o");
    await ready();
    button("Ask AI").click();
    await expect.poll(() => chat.length).toBe(2);
    expect(chat[1]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(chat[1]!.model).toBe("openai/gpt-4o");
  });

  it("an invalid key is reported", async () => {
    fakeFetch([], true, { status: { anthropic: 401 } });
    setup(() => true, { anthropicKey: keys.anthropicKey });
    await expect.poll(() => target!.textContent).toContain("Anthropic API key is not valid");
  });
});
