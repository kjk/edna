import { getLanguage, langSupportsRun } from "./editor/languages";

// what Smart Run (Mod + E) does
export type SmartRunAction = "functionWithSelection" | "codeBlock" | "functionWithBlock";

export const smartRunLabels: Record<SmartRunAction, string> = {
  functionWithSelection: "Run Function With Selection",
  codeBlock: "Run Code Block",
  functionWithBlock: "Run Function With Block Content",
};

// true if code in a block of language token can be run
export function blockLanguageSupportsRun(token: string): boolean {
  return langSupportsRun(getLanguage(token));
}

// with a selection: run a function on it; otherwise run the block's code if
// its language supports it, or run a function on the block's content
export function smartRunAction(hasSelection: boolean, blockLanguage: string): SmartRunAction {
  if (hasSelection) {
    return "functionWithSelection";
  }
  return blockLanguageSupportsRun(blockLanguage) ? "codeBlock" : "functionWithBlock";
}
