import { loadModels, modelKey, parseModelKey, pickClosestModel, type AiModel } from "./ai-models";
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

let cancelModelLoad: (() => void) | undefined;

/**
 * Debounces typing and pasting API keys. Cancellation covers the timer, any
 * requests it started, and the resulting cache and settings updates.
 */
export function scheduleAiModelRefresh(settings: Settings): () => void {
  cancelModelLoad?.();
  const controller = new AbortController();
  const { signal } = controller;
  const timer = setTimeout(async () => {
    aiModelsState.loading = true;
    try {
      const results = await loadModels(settings, { signal });
      signal.throwIfAborted();
      aiModelsState.models = results.flatMap((r) => r.models);
      aiModelsState.errors = results.flatMap((r) => (r.error ? [r.error] : []));
      validateAiModelSettings(settings, aiModelsState.models);
    } catch (error) {
      if (!signal.aborted) {
        console.error("Failed to load AI models", error);
        aiModelsState.errors = [String(error)];
      }
    } finally {
      finish();
    }
  }, 300);

  function finish() {
    if (cancelModelLoad === cancel) {
      cancelModelLoad = undefined;
      aiModelsState.loading = false;
    }
  }

  function cancel() {
    clearTimeout(timer);
    controller.abort();
    finish();
  }

  cancelModelLoad = cancel;
  return cancel;
}

/**
 * Makes settings.aiModelID one of models: if it's not available (any more),
 * picks the closest available model. Starred models with an id from an older
 * version of Edna (no provider) become the key of the matching model.
 * Does nothing without models: lists might not be loaded (e.g. offline).
 */
function validateAiModelSettings(settings: Settings, models: AiModel[]) {
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
