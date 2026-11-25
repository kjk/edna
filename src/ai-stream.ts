import type { AiProvider } from "./ai-models";
import { tryParseJSON } from "./util";

const maxTokens = 10000;

export async function streamChatResponse(
  provider: AiProvider,
  apiKey: string,
  modelID: string,
  prompt: string,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<void> {
  const response = await fetch(provider.chatURL, {
    signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...provider.chatHeaders,
    },
    body: JSON.stringify({
      model: modelID,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      [provider.maxTokensField ?? "max_tokens"]: maxTokens,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`HTTP error! status: ${response.status}${details ? "\n" + details : ""}`);
  }
  if (!response.body) {
    throw new Error("AI provider returned no response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = done ? "" : lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          return;
        }
        onText(parseChatStreamData(data));
      }
      if (done) {
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

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
