import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getActiveNoteBlock, getFirstNoteBlock } from "./block";

const selectEmptyBlock = StateEffect.define<number>();

export const emptyBlockSelected = StateField.define<number | null>({
  create: () => null,
  update(selected, tr) {
    for (const effect of tr.effects) {
      if (effect.is(selectEmptyBlock)) return effect.value;
    }
    return tr.docChanged || tr.selection ? null : selected;
  },
});

export function selectAll({ state, dispatch }: EditorView): boolean {
  const first = getFirstNoteBlock(state);
  const block = getActiveNoteBlock(state) ?? first;
  if (!block) return false;
  const { from, to } = state.selection.main;
  const empty = block.contentFrom === block.to;
  const alreadySelected = empty
    ? state.field(emptyBlockSelected, false) === block.index
    : from === block.contentFrom && to === block.to;
  const all = alreadySelected || (from === first.contentFrom && to === state.doc.length && !empty);
  dispatch(state.update({
    selection: all
      ? EditorSelection.range(first.contentFrom, state.doc.length)
      : EditorSelection.range(block.contentFrom, block.to),
    effects: empty && !all ? selectEmptyBlock.of(block.index) : undefined,
    userEvent: "select.all",
  }));
  return true;
}
