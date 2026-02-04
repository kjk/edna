import type { SelectionRange } from "@codemirror/state";

export interface LineBlock {
  from: number;
  to: number;
  ranges: SelectionRange[];
}
