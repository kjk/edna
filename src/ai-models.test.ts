import { expect, test, vi } from "vitest";
import {
  providerFromModelsURL,
  kModelsCacheKey,
  loadModels,
  modelKey,
  parseModelKey,
  parseModelsResponse,
  pickClosestModel,
  type AiModel,
} from "./ai-models";

const openAIKey = "sk-proj-" + "x".repeat(60);
const openRouterKey = "sk-or-v1-" + "y".repeat(60);
const anthropicKey = "sk-ant-" + "z".repeat(60);

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

test("modelKey / parseModelKey", () => {
  const m: AiModel = { provider: "openrouter", id: "openai/gpt-4o:free", name: "x" };
  expect(modelKey(m)).toBe("openrouter/openai/gpt-4o:free");
  expect(parseModelKey("openrouter/openai/gpt-4o:free")).toEqual({ provider: "openrouter", id: "openai/gpt-4o:free" });
  expect(parseModelKey("gpt-4o")).toBeUndefined();
  expect(parseModelKey("google/gemini")).toBeUndefined();
});

test("parseModelsResponse", () => {
  const openai = parseModelsResponse("openai", {
    data: [{ id: "gpt-4o" }, { id: "text-embedding-3-small" }, { id: "gpt-4o-realtime-preview" }, { id: "o3" }, { id: "dall-e-3" }],
  });
  expect(openai.map((m) => m.id)).toEqual(["gpt-4o", "o3"]);

  const anthropic = parseModelsResponse("anthropic", { data: [{ id: "claude-sonnet-4-5", display_name: "Claude Sonnet 4.5" }] });
  expect(anthropic).toEqual([{ provider: "anthropic", id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" }]);

  const or = parseModelsResponse("openrouter", {
    data: [
      { id: "openai/gpt-4o", name: "OpenAI: GPT-4o", pricing: { prompt: "0.0000025", completion: "0.00001" } },
      { id: "x/image-only", name: "img", architecture: { output_modalities: ["image"] } },
      { id: "openrouter/auto", name: "Auto", pricing: { prompt: "-1", completion: "-1" } },
    ],
  });
  expect(or).toEqual([
    { provider: "openrouter", id: "openai/gpt-4o", name: "OpenAI: GPT-4o", pricePrompt: 0.0000025, priceCompletion: 0.00001 },
    { provider: "openrouter", id: "openrouter/auto", name: "Auto" },
  ]);

  expect(() => parseModelsResponse("xai", { error: "nope" })).toThrow("unexpected");
});

const models: AiModel[] = [
  { provider: "openai", id: "gpt-4o", name: "gpt-4o" },
  { provider: "openai", id: "gpt-4o-mini", name: "gpt-4o-mini" },
  { provider: "anthropic", id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
  { provider: "openrouter", id: "openai/gpt-4o", name: "OpenAI: GPT-4o" },
  { provider: "openrouter", id: "moonshotai/kimi-k2:free", name: "Kimi K2 (free)" },
];

test("pickClosestModel", () => {
  // available
  expect(pickClosestModel("openrouter/openai/gpt-4o", models)).toBe("openrouter/openai/gpt-4o");
  // legacy id (no provider): direct provider preferred
  expect(pickClosestModel("gpt-4o", models)).toBe("openai/gpt-4o");
  expect(pickClosestModel("kimi-k2:free", models)).toBe("openrouter/moonshotai/kimi-k2:free");
  // provider no longer available: the same model from another provider
  expect(pickClosestModel("xai/gpt-4o", models)).toBe("openai/gpt-4o");
  // model no longer available: the most similar
  expect(pickClosestModel("openai/gpt-4o-2024-08-06", models)).toBe("openai/gpt-4o");
  expect(pickClosestModel("anthropic/claude-sonnet-4-0", models)).toBe("anthropic/claude-sonnet-4-5");
  // no current model: a preferred one
  expect(pickClosestModel("", models)).toBe("anthropic/claude-sonnet-4-5");
  expect(pickClosestModel("gpt-4o", [])).toBeUndefined();
});

function fakeFetch(responses: Record<string, { status: number; body: unknown }>) {
  const calls: { url: string; key: string }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const key = (init?.headers as Record<string, string>)["X-Api-Key"]!;
    calls.push({ url, key });
    const r = responses[providerFromModelsURL(url)!]!;
    return Response.json(r.body, { status: r.status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test("loadModels: only providers with a key, cached for a day, re-fetched when the key changes", async () => {
  const storage = new MemStorage() as unknown as Storage;
  const { fn, calls } = fakeFetch({
    openai: { status: 200, body: { data: [{ id: "gpt-4o" }] } },
    openrouter: { status: 200, body: { data: [{ id: "openai/gpt-4o", name: "GPT-4o" }] } },
  });
  const keys = { openAIKey, openRouterKey, xAIKey: "bad" };
  let now = 1_000_000;
  let res = await loadModels(keys, { fetchFn: fn, storage, now });
  expect(res.map((r) => r.provider)).toEqual(["openai", "openrouter"]);
  expect(calls.map((c) => c.url)).toEqual(["/api/ai/models?provider=openai", "/api/ai/models?provider=openrouter"]);
  expect(calls[0]!.key).toBe(openAIKey);
  // the key itself isn't stored in the cache
  expect(storage.getItem(kModelsCacheKey)).not.toContain(openAIKey);

  // from cache
  now += 3600 * 1000;
  res = await loadModels(keys, { fetchFn: fn, storage, now });
  expect(calls.length).toBe(2);
  expect(res[0]!.models[0]!.id).toBe("gpt-4o");

  // older than a day
  now += 24 * 3600 * 1000;
  await loadModels(keys, { fetchFn: fn, storage, now });
  expect(calls.length).toBe(4);

  // a different key
  await loadModels({ ...keys, openAIKey: openAIKey + "2" }, { fetchFn: fn, storage, now });
  expect(calls.length).toBe(5);
});

test("loadModels: invalid key and failures", async () => {
  const storage = new MemStorage() as unknown as Storage;
  let ok = fakeFetch({ openrouter: { status: 200, body: { data: [{ id: "a/b", name: "B" }] } } });
  await loadModels({ openRouterKey }, { fetchFn: ok.fn, storage, now: 0 });

  // network failure after the cache expired: cached list is used, error reported
  let failing = fakeFetch({
    openrouter: { status: 502, body: {} },
    anthropic: { status: 401, body: { error: "invalid x-api-key" } },
  });
  const res = await loadModels({ openRouterKey, anthropicKey }, { fetchFn: failing.fn, storage, now: 2 * 24 * 3600 * 1000 });
  const or = res.find((r) => r.provider === "openrouter")!;
  expect(or.models.map((m) => m.id)).toEqual(["a/b"]);
  expect(or.error).toContain("502");
  const an = res.find((r) => r.provider === "anthropic")!;
  expect(an.invalidKey).toBe(true);
  expect(an.models).toEqual([]);
});

test("an aborted model load cannot overwrite the cache of a newer load", async () => {
  const storage = new MemStorage() as unknown as Storage;
  const oldLoad = new AbortController();
  const oldResponse = Promise.withResolvers<Response>();
  const oldFetch = vi.fn<typeof fetch>().mockReturnValue(oldResponse.promise);
  const pending = loadModels({ openAIKey }, { fetchFn: oldFetch, storage, signal: oldLoad.signal });
  const aborted = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  oldLoad.abort();

  const newKey = openAIKey + "2";
  const fresh = fakeFetch({ openai: { status: 200, body: { data: [{ id: "gpt-4o-mini" }] } } });
  await loadModels({ openAIKey: newKey }, { fetchFn: fresh.fn, storage });
  oldResponse.resolve(Response.json({ data: [{ id: "gpt-4o" }] }));
  await aborted;

  const models = await loadModels({ openAIKey: newKey }, { fetchFn: fresh.fn, storage });
  expect(models[0]!.models.map((m) => m.id)).toEqual(["gpt-4o-mini"]);
  expect(fresh.calls).toHaveLength(1);
});
