// Lists of AI models, downloaded from each AI provider for which the user has
// an API key (through our server: /api/ai/models), cached in localStorage.

import { tryParseJSONObject } from "./util";

export type AiProviderID = "openai" | "anthropic" | "xai" | "openrouter";

export interface AiProvider {
  id: AiProviderID;
  name: string;
  // name of the API key in settings
  keySetting: "openAIKey" | "anthropicKey" | "xAIKey" | "openRouterKey";
  // OpenAI-compatible chat completions endpoint
  chatURL: string;
  helpURL: string;
  looksValidKey: (key: string) => boolean;
}

// keys can change format: only check for the documented prefix
export const aiProviders: AiProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    keySetting: "openAIKey",
    chatURL: "https://api.openai.com/v1/chat/completions",
    helpURL: "/help#getting-openai-api-key",
    // Anthropic / OpenRouter keys also start with "sk-"
    looksValidKey: (k) => k.startsWith("sk-") && !/^sk-(ant|or)-/.test(k) && k.length > 40,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keySetting: "anthropicKey",
    chatURL: "https://api.anthropic.com/v1/chat/completions",
    helpURL: "/help#getting-anthropic-api-key",
    looksValidKey: (k) => k.startsWith("sk-ant-") && k.length > 40,
  },
  {
    id: "xai",
    name: "xAI",
    keySetting: "xAIKey",
    chatURL: "https://api.x.ai/v1/chat/completions",
    helpURL: "/help#getting-xai-(grok)-api-key",
    looksValidKey: (k) => k.startsWith("xai-") && k.length > 40,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    keySetting: "openRouterKey",
    chatURL: "https://openrouter.ai/api/v1/chat/completions",
    helpURL: "/help#getting-openrouter-api-key",
    looksValidKey: (k) => k.startsWith("sk-or-") && k.length > 40,
  },
];

export function getAiProvider(id: string): AiProvider | undefined {
  return aiProviders.find((p) => p.id === id);
}

export type AiKeys = Partial<Record<AiProvider["keySetting"], string>>;

// API key for provider from keys (e.g. settings), trimmed
export function providerKey(keys: AiKeys, provider: AiProvider): string {
  return (keys[provider.keySetting] || "").trim();
}

export interface AiModel {
  provider: AiProviderID;
  id: string; // id in the provider's API, e.g. "gpt-4o" or (OpenRouter) "openai/gpt-4o"
  name: string;
  // price per token in USD, if the provider tells us (only OpenRouter)
  pricePrompt?: number;
  priceCompletion?: number;
}

// unique id of a model across providers, stored in settings: "openai/gpt-4o",
// "openrouter/openai/gpt-4o"
export function modelKey(m: AiModel): string {
  return m.provider + "/" + m.id;
}

export function parseModelKey(key: string): { provider: AiProviderID; id: string } | undefined {
  let idx = key.indexOf("/");
  if (idx < 0) {
    return undefined;
  }
  let provider = key.slice(0, idx);
  if (!getAiProvider(provider)) {
    return undefined;
  }
  return { provider: provider as AiProviderID, id: key.slice(idx + 1) };
}

// OpenAI's list includes embedding, audio, image, moderation etc. models
// that can't be used for chat
function isOpenAIChatModel(id: string): boolean {
  if (!/^(gpt-|o\d|chatgpt-)/.test(id)) {
    return false;
  }
  return !/(audio|realtime|tts|transcribe|image|embedding|moderation|search|instruct)/.test(id);
}

function isXAIChatModel(id: string): boolean {
  return !/(image|imagine|video|embed)/.test(id);
}

/**
 * Converts the response of a provider's "list models" API to AiModel[].
 * Throws if the response doesn't have the expected shape.
 */
export function parseModelsResponse(provider: AiProviderID, json: any): AiModel[] {
  let data = json?.data;
  if (!Array.isArray(data)) {
    throw new Error(`unexpected list of models from ${provider}`);
  }
  let res: AiModel[] = [];
  for (let m of data) {
    let id = m?.id;
    if (typeof id !== "string" || id === "") {
      continue;
    }
    if (provider === "openai" && !isOpenAIChatModel(id)) {
      continue;
    }
    if (provider === "xai" && !isXAIChatModel(id)) {
      continue;
    }
    let model: AiModel = { provider, id, name: id };
    if (provider === "anthropic" && typeof m.display_name === "string") {
      model.name = m.display_name;
    }
    if (provider === "openrouter") {
      let outputs = m.architecture?.output_modalities;
      if (Array.isArray(outputs) && !outputs.includes("text")) {
        continue;
      }
      if (typeof m.name === "string") {
        model.name = m.name;
      }
      let pp = parseFloat(m.pricing?.prompt);
      let pc = parseFloat(m.pricing?.completion);
      // OpenRouter uses -1 for "variable" prices (e.g. its router)
      if (Number.isFinite(pp) && pp >= 0) model.pricePrompt = pp;
      if (Number.isFinite(pc) && pc >= 0) model.priceCompletion = pc;
    }
    res.push(model);
  }
  return res;
}

// --- cache

export const kModelsCacheKey = "edna-ai-models";
const kMaxCacheAgeMs = 24 * 3600 * 1000;

interface ProviderCacheEntry {
  fetchedAt: number; // Date.now()
  keyHash: string; // the cached list is for this key
  models: AiModel[];
}
type ModelsCache = Partial<Record<AiProviderID, ProviderCacheEntry>>;

// short fingerprint of an API key: re-fetch when the key changes, without
// storing the key itself again
export function keyFingerprint(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16) + ":" + key.length;
}

function loadCache(storage: Storage): ModelsCache {
  return tryParseJSONObject(storage.getItem(kModelsCacheKey) || "{}", "models cache");
}

function saveCache(storage: Storage, cache: ModelsCache) {
  try {
    storage.setItem(kModelsCacheKey, JSON.stringify(cache));
  } catch (e) {
    console.error("saveCache: failed to save AI models", e);
  }
}

export interface ProviderModelsResult {
  provider: AiProviderID;
  models: AiModel[];
  error?: string; // e.g. invalid key, network error (models are then from the cache, if any)
  invalidKey?: boolean;
}

export interface LoadModelsOptions {
  force?: boolean; // ignore cache age
  fetchFn?: typeof fetch;
  storage?: Storage;
  now?: number;
}

async function fetchProviderModels(provider: AiProvider, key: string, fetchFn: typeof fetch): Promise<AiModel[]> {
  let rsp = await fetchFn(`/api/ai/models?provider=${provider.id}`, {
    headers: { "X-Api-Key": key },
  });
  if (rsp.status === 401 || rsp.status === 403) {
    let e = new Error(`${provider.name} API key is not valid`);
    (e as any).invalidKey = true;
    throw e;
  }
  if (!rsp.ok) {
    throw new Error(`getting ${provider.name} models failed: HTTP ${rsp.status}`);
  }
  return parseModelsResponse(provider.id, await rsp.json());
}

/**
 * Returns models of each provider for which keys has a valid looking key.
 * Lists older than a day (or for a different key) are re-fetched; if that
 * fails, the cached list (if any) is used and the error is reported.
 */
export async function loadModels(keys: AiKeys, opts: LoadModelsOptions = {}): Promise<ProviderModelsResult[]> {
  let fetchFn = opts.fetchFn ?? fetch.bind(window);
  let storage = opts.storage ?? localStorage;
  let now = opts.now ?? Date.now();
  let cache = loadCache(storage);
  let results = await Promise.all(
    aiProviders.map(async (provider): Promise<ProviderModelsResult | null> => {
      let key = providerKey(keys, provider);
      if (!provider.looksValidKey(key)) {
        return null;
      }
      let keyHash = keyFingerprint(key);
      let cached = cache[provider.id];
      let cacheMatches = cached && cached.keyHash === keyHash && Array.isArray(cached.models);
      if (cacheMatches && !opts.force && now - cached!.fetchedAt < kMaxCacheAgeMs) {
        return { provider: provider.id, models: cached!.models };
      }
      try {
        let models = await fetchProviderModels(provider, key, fetchFn);
        cache[provider.id] = { fetchedAt: now, keyHash, models };
        return { provider: provider.id, models };
      } catch (e: any) {
        console.error(`loadModels: ${provider.id}:`, e);
        if (e?.invalidKey) {
          delete cache[provider.id];
          return { provider: provider.id, models: [], error: e.message, invalidKey: true };
        }
        return { provider: provider.id, models: cacheMatches ? cached!.models : [], error: String(e?.message ?? e) };
      }
    }),
  );
  saveCache(storage, cache);
  return results.filter((r) => r !== null);
}

// --- picking a model

// model id without a vendor prefix, OpenRouter variant and snapshot date:
// "openai/gpt-4o:free" => "gpt-4o", "gpt-4o-2024-08-06" => "gpt-4o"
function baseModelID(id: string): string {
  let s = id.slice(id.lastIndexOf("/") + 1);
  let idx = s.indexOf(":");
  s = (idx >= 0 ? s.slice(0, idx) : s).toLowerCase();
  return s.replace(/-(\d{4}-\d{2}-\d{2}|\d{8}|latest)$/, "");
}

function commonPrefixLen(a: string, b: string): number {
  let n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// direct providers are preferred over OpenRouter (no extra fee)
function providerRank(p: AiProviderID): number {
  return p === "openrouter" ? 1 : 0;
}

// models to pick when there's no model to be close to, in order of preference
const kPreferredModels = ["claude-sonnet", "gpt-5", "grok-4", "gemini", "claude", "gpt"];

/**
 * Returns the key of the model in models closest to the model with key
 * (which might no longer be available, or be an id from an older version of
 * Edna without a provider, e.g. "gpt-4o"): the same model from another
 * provider, otherwise the model whose id is most similar. undefined if there
 * are no models.
 */
export function pickClosestModel(key: string, models: AiModel[]): string | undefined {
  if (models.length === 0) {
    return undefined;
  }
  if (models.some((m) => modelKey(m) === key)) {
    return key;
  }
  let parsed = parseModelKey(key);
  let wantID = baseModelID(parsed ? parsed.id : key);
  let best: AiModel | undefined;
  let bestScore = -1;
  for (let m of models) {
    let id = baseModelID(m.id);
    let score: number;
    if (wantID === "") {
      let idx = kPreferredModels.findIndex((p) => id.startsWith(p));
      score = idx < 0 ? 0 : 1000 - idx;
    } else if (id === wantID) {
      score = 100000;
    } else {
      // e.g. "gpt-4o-2024-08-06" is close to "gpt-4o"
      score = commonPrefixLen(id, wantID) * 100 - Math.abs(id.length - wantID.length);
    }
    // prefer the same provider, then direct providers
    if (parsed && m.provider === parsed.provider) score += 10;
    score -= providerRank(m.provider) * 5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best ? modelKey(best) : undefined;
}

export function findModel(key: string, models: AiModel[]): AiModel | undefined {
  return models.find((m) => modelKey(m) === key);
}
