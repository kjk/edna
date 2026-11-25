import { getBlockRunner } from "./run";

// what Smart Run (Mod + E) does
export type SmartRunAction = "functionWithSelection" | "codeBlock" | "functionWithBlock";

export const smartRunLabels: Record<SmartRunAction, string> = {
  functionWithSelection: "Run Function With Selection",
  codeBlock: "Run Code Block",
  functionWithBlock: "Run Function With Block Content",
};

// with a selection: run a function on it; otherwise run the block's code if
// its language supports it, or run a function on the block's content
export function smartRunAction(hasSelection: boolean, blockLanguage: string): SmartRunAction {
  if (hasSelection) {
    return "functionWithSelection";
  }
  return getBlockRunner(blockLanguage) ? "codeBlock" : "functionWithBlock";
}
