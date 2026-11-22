import { expect, test } from "vitest";
import { parseChatStreamData } from "./ai-stream";

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
