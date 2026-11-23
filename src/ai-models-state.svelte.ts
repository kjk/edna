import {
  aiProviders,
  loadModels,
  modelKey,
  parseModelKey,
  pickClosestModel,
  type AiKeys,
  type AiModel,
  type LoadModelsOptions,
  type ProviderModelsResult,
} from "./ai-models";
import type { Settings } from "./settings.svelte";
import { assignIfChanged, pushIfNotExists } from "./util";

class AiModelsState {
  // models of all providers for which the user has a valid API key
  models: AiModel[] = $state([]);
  // per provider errors (invalid key, network error) from the last load
  errors: string[] = $state([]);
  loading = $state(false);
}

export const aiModelsState = new AiModelsState();

function keysFromSettings(settings: Settings): AiKeys {
  let keys: AiKeys = {};
  for (let p of aiProviders) {
    keys[p.keySetting] = settings[p.keySetting];
  }
  return keys;
}

// the latest load wins: a load for older keys must not overwrite a newer one
let loadGen = 0;

/**
 * Loads lists of models (from the cache if not older than a day) for providers
 * with a valid looking API key in settings, then validates the AI model
 * settings against them.
 */
export async function refreshAiModels(settings: Settings, opts: LoadModelsOptions = {}): Promise<void> {
  let gen = ++loadGen;
  aiModelsState.loading = true;
  let results: ProviderModelsResult[];
  try {
    results = await loadModels(keysFromSettings(settings), opts);
  } finally {
    if (gen === loadGen) {
      aiModelsState.loading = false;
    }
  }
  if (gen !== loadGen) {
    return;
  }
  aiModelsState.models = results.flatMap((r) => r.models);
  aiModelsState.errors = results.filter((r) => r.error).map((r) => r.error!);
  validateAiModelSettings(settings, aiModelsState.models);
}

/**
 * Makes settings.aiModelID one of models: if it's not available (any more),
 * picks the closest available model. Starred models with an id from an older
 * version of Edna (no provider) become the key of the matching model.
 * Does nothing without models: lists might not be loaded (e.g. offline).
 */
export function validateAiModelSettings(settings: Settings, models: AiModel[]) {
  if (models.length === 0) {
    return;
  }
  let closest = pickClosestModel(settings.aiModelID, models);
  if (closest && closest !== settings.aiModelID) {
    console.log(`validateAiModelSettings: model '${settings.aiModelID}' not available, using '${closest}'`);
    settings.aiModelID = closest;
  }
  let starred: string[] = [];
  for (let key of settings.starredModels) {
    if (!parseModelKey(key)) {
      // e.g. "gpt-4o": the same model, preferably from a direct provider
      let m = models.find((m) => m.id === key || m.id.endsWith("/" + key));
      if (!m) {
        continue;
      }
      key = modelKey(m);
    }
    pushIfNotExists(starred, key);
  }
  assignIfChanged(settings, "starredModels", starred);
}
