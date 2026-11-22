import { expect, test } from "vitest";
import { isOpenRouterOnlyModel } from "./ai-provider";

// U24
test("isOpenRouterOnlyModel", () => {
  for (let id of ["gpt-oss-120b:free", "gpt-4o:extended", "o4-mini-high", "gpt-oss-120b", "gpt-5-image-mini"]) {
    expect(isOpenRouterOnlyModel(id), id).toBe(true);
  }
  for (let id of ["gpt-4o", "gpt-5.1", "o4-mini", "o3", "grok-4", "grok-code-fast-1"]) {
    expect(isOpenRouterOnlyModel(id), id).toBe(false);
  }
});
