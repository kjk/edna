import type { SelectionRange } from "@codemirror/state";

export interface SimpleRange {
  from: number;
  to: number;
}

export interface LineBlock extends SimpleRange {
  ranges: SelectionRange[];
}
