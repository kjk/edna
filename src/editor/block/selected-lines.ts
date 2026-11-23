import type { EditorState } from "@codemirror/state";
import { pushOrMerge } from "../../util";
import { rangeLineNumbers } from "../cmutils";
import { getNoteBlocksBetween, type Block } from "./block";

interface SelectedLines {
  block: Block;
  first: number;
  last: number;
}

export function selectedLines(state: EditorState): SelectedLines[] {
  const { doc } = state;
  const groups: SelectedLines[] = [];
  for (const range of state.selection.ranges) {
    for (const block of getNoteBlocksBetween(state, range.from, range.to)) {
      const from = Math.max(range.from, block.contentFrom);
      const to = Math.min(range.to, block.to);
      if (to < from && !range.empty) continue;

      const { first, last } = rangeLineNumbers(doc, from, to);
      if (!range.empty && range.to === block.contentFrom) continue;

      pushOrMerge(
        groups,
        { block, first, last },
        (prev, group) => prev.block === group.block && prev.last + 1 >= group.first,
        (prev, group) => (prev.last = Math.max(prev.last, group.last)),
      );
    }
  }
  return groups;
}
