import { EditorSelection, type Line } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { blockContentText, blockLineRange, getBlockN, getNoteBlockFromPos, outOfBlockHeader, type Block } from "./block";
import { commonPrefixLen } from "../../util";
import { selectedLines } from "./selected-lines";

function moveLines(view: EditorView, forward: boolean): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const groups = selectedLines(state);
  if (forward) groups.reverse();

  const blockLines = new Map<Block, Line[]>();
  function linesOf(block: Block): Line[] {
    const cached = blockLines.get(block);
    if (cached) return cached;
    const { first, last } = blockLineRange(state.doc, block);
    const lines = Array.from({ length: last - first + 1 }, (_, i) => state.doc.line(first + i));
    blockLines.set(block, lines);
    return lines;
  }

  let moved = false;
  for (const { block, first, last } of groups) {
    const lines = linesOf(block);
    const start = lines.findIndex((line) => line.number === first);
    const count = last - first + 1;
    const edge = forward ? start + count === lines.length : start === 0;
    const adjacent = edge ? getBlockN(state, block.index + (forward ? 1 : -1)) : null;
    if (edge && !adjacent) continue;

    const movedLines = lines.splice(start, count);
    if (adjacent) {
      const target = linesOf(adjacent);
      blockLines.set(adjacent, forward ? movedLines.concat(target) : target.concat(movedLines));
    } else {
      const destination = start + (forward ? 1 : -1);
      blockLines.set(block, lines.slice(0, destination).concat(movedLines, lines.slice(destination)));
    }
    moved = true;
  }

  if (!moved) return false;
  const changes = state.changes(Array.from(blockLines, ([block, lines]) => {
    const original = blockContentText(state, block);
    const updated = lines.map((line) => line.text).join("\n");
    const prefix = commonPrefixLen(original, updated);
    let suffix = 0;
    const limit = Math.min(original.length, updated.length);
    while (suffix < limit - prefix && original[original.length - suffix - 1] === updated[updated.length - suffix - 1]) suffix++;
    return {
      from: block.contentFrom + prefix,
      to: block.to - suffix,
      insert: updated.slice(prefix, updated.length - suffix),
    };
  }));

  const linePositions = new Map<number, { from: number; hasFollowingLine: boolean }>();
  for (const [block, lines] of blockLines) {
    let from = changes.mapPos(block.contentFrom, -1);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      linePositions.set(line.number, { from, hasFollowingLine: i < lines.length - 1 });
      from += line.length + 1;
    }
  }

  function movedPosition(pos: number, end: boolean): number {
    pos = outOfBlockHeader(getNoteBlockFromPos(state, pos), pos);
    const line = state.doc.lineAt(pos);
    if (end && pos === line.from && line.number > 1) {
      const previous = state.doc.line(line.number - 1);
      const moved = linePositions.get(previous.number);
      if (moved) return moved.from + previous.length + Number(moved.hasFollowingLine);
    }
    const moved = linePositions.get(line.number);
    return moved ? moved.from + pos - line.from : changes.mapPos(pos);
  }

  const ranges = state.selection.ranges.map((range) => EditorSelection.range(
    movedPosition(range.anchor, !range.empty && range.anchor === range.to),
    movedPosition(range.head, !range.empty && range.head === range.to),
  ));
  view.dispatch({
    changes,
    selection: EditorSelection.create(ranges, state.selection.mainIndex),
    scrollIntoView: true,
    userEvent: "move.line",
  });
  return true;
}

export const moveLineUp = (view: EditorView): boolean => moveLines(view, false);
export const moveLineDown = (view: EditorView): boolean => moveLines(view, true);
