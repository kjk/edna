import { expect, test, vi } from "vitest";
import { aiProviders } from "./ai-models";
import { parseChatStreamData, streamChatResponse } from "./ai-stream";

// in-stream errors are reported, not swallowed (U18)
test("parseChatStreamData", () => {
  expect(parseChatStreamData('{"choices":[{"delta":{"content":"hi"}}]}')).toBe("hi");
  expect(parseChatStreamData('{"choices":[{"delta":{}}]}')).toBe("");
  expect(parseChatStreamData('{"choices":[]}')).toBe("");
  expect(parseChatStreamData("{}")).toBe("");
  expect(parseChatStreamData("not json")).toBe("");
  expect(() => parseChatStreamData('{"error":{"message":"Rate limit exceeded","code":429}}')).toThrow("Rate limit exceeded");
  expect(() => parseChatStreamData('{"error":"boom"}')).toThrow("boom");
});

test("streamChatResponse reads split UTF-8 and a final line without a newline", async () => {
  const data = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`;
  const bytes = new TextEncoder().encode(data("🌱") + "\r\n" + data(" grows"));
  const split = bytes.indexOf(0xf0) + 1;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
  try {
    const parts: string[] = [];
    await streamChatResponse(aiProviders[0]!, "key", "gpt-4o", "question", new AbortController().signal, (text) => {
      parts.push(text);
    });
    expect(parts.join("")).toBe("🌱 grows");
  } finally {
    vi.unstubAllGlobals();
  }
});
