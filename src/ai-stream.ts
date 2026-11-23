import { tryParseJSON } from "./util";

/**
 * Parses the data of one server-sent event line ("data: {...}") of a streaming
 * chat completion. Returns the text to append (possibly ""). Throws if the
 * provider sent an error: some do that after HTTP 200, e.g. when rate limited
 * or when the upstream provider failed (U18). Invalid JSON is skipped.
 */
export function parseChatStreamData(data: string): string {
  let parsed: any = tryParseJSON(data, "chat stream data");
  if (parsed === undefined) {
    return "";
  }
  if (parsed && parsed.error) {
    let e = parsed.error;
    let msg = typeof e === "string" ? e : e.message || JSON.stringify(e);
    throw new Error(`AI provider error: ${msg}`);
  }
  let content = parsed?.choices?.[0]?.delta?.content;
  return typeof content === "string" ? content : "";
}
