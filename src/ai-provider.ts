/**
 * Model ids in models-short.ts are OpenRouter ids. Some OpenAI / xAI models are
 * also called directly with the provider's API using the same id, but some ids
 * exist only on OpenRouter and the provider's API rejects them (U24):
 * - variants with a ":" suffix (:free, :extended, :exacto, ...)
 * - OpenRouter aliases for a reasoning effort (o4-mini-high, o3-mini-high)
 * - open-weight models hosted by others (gpt-oss-*)
 * - OpenRouter composite models (gpt-5-image*)
 */
export function isOpenRouterOnlyModel(modelID: string): boolean {
  return (
    modelID.includes(":") ||
    modelID.endsWith("-high") ||
    modelID.startsWith("gpt-oss-") ||
    modelID.startsWith("gpt-5-image")
  );
}

/**
 * True if a failed chat completion response says the model doesn't exist (or
 * the key can't use it). isOpenRouterOnlyModel() is a heuristic: when the
 * provider's API rejects a model, the request can be retried with OpenRouter.
 */
export async function isUnknownModelResponse(r: Response): Promise<boolean> {
  if (r.status !== 400 && r.status !== 404) {
    return false;
  }
  try {
    let s = await r.clone().text();
    return /model/i.test(s);
  } catch {
    return false;
  }
}
