import type { EditorState } from "@codemirror/state";
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

      const first = doc.lineAt(from).number;
      let last = doc.lineAt(Math.max(from, to)).number;
      if (last > first && doc.line(last).from === to) last--;
      if (!range.empty && range.to === block.contentFrom) continue;

      const previous = groups.at(-1);
      if (previous?.block === block && previous.last + 1 >= first) {
        previous.last = Math.max(previous.last, last);
      } else {
        groups.push({ block, first, last });
      }
    }
  }
  return groups;
}
