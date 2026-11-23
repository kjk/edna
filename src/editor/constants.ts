import type { Text } from "@codemirror/state";
import type { SimpleRange } from "./types";

export const kFoldLabelLength = 50;

// range to fold for block content from..to: the first line stays visible up to
// kFoldLabelLength characters. null if there's nothing to fold.
// foldSingleLine: also fold the rest of a long first line when it's the only line
export function contentFoldRange(doc: Text, from: number, to: number, foldSingleLine: boolean): SimpleRange | null {
  if (from >= to) return null;
  const firstLine = doc.lineAt(from);
  if (!foldSingleLine && firstLine.to >= to) return null;
  const foldFrom = Math.min(firstLine.to, from + kFoldLabelLength);
  return foldFrom >= to ? null : { from: foldFrom, to };
}
