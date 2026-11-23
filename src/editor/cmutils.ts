import { foldedRanges, syntaxTree } from "@codemirror/language";
import { EditorSelection, type EditorState, type Text } from "@codemirror/state";
import { ViewPlugin, type Command, type DecorationSet, type DOMEventHandlers, type EditorView, type ViewUpdate } from "@codemirror/view";
import type { SimpleRange } from "./types";

export function isReadOnly(view: EditorView): boolean {
  return view.state.readOnly;
}

export function getCurrentSelection(state: EditorState): SimpleRange & { selectedText: string } {
  const { from, to } = state.selection.main;
  return { from, to, selectedText: state.sliceDoc(from, to) };
}

// true if any selection range (or, with mainOnly, the main one) is not empty
export function hasSelection(state: EditorState, mainOnly = false): boolean {
  if (mainOnly) {
    return !state.selection.main.empty;
  }
  return state.selection.ranges.some((range) => !range.empty);
}

// numbers of the first and last line covered by from..to; a non-empty range
// ending at the start of a line doesn't cover that line
export function rangeLineNumbers(doc: Text, from: number, to: number): { first: number; last: number } {
  const first = doc.lineAt(from).number;
  let last = doc.lineAt(Math.max(from, to)).number;
  if (last > first && doc.line(last).from === to) last--;
  return { first, last };
}

// collapse every selection range to a cursor at its head
export function collapseSelectionToHeads(view: EditorView): void {
  const { ranges, mainIndex } = view.state.selection;
  view.dispatch({
    selection: EditorSelection.create(
      ranges.map((range) => EditorSelection.cursor(range.head)),
      mainIndex,
    ),
    userEvent: "select",
  });
}

export function focusEditorView(view: EditorView): void {
  view.focus();
}

export function getFoldedRanges(view: EditorView): SimpleRange[] {
  const ranges: SimpleRange[] = [];
  const iter = foldedRanges(view.state).iter();
  for (; iter.value; iter.next()) {
    ranges.push({ from: iter.from, to: iter.to });
  }
  return ranges;
}

// command that runs run() and always reports the key as handled
export function consume(run: (view: EditorView) => unknown): Command {
  return (view) => {
    run(view);
    return true;
  };
}

// like consume() but doesn't run in a read-only editor
export function editCommand(run: Command): Command {
  return consume((view) => {
    if (!view.state.readOnly) run(view);
  });
}

// state to give all items when toggling them as a group (folds, checkboxes):
// set them if at most half of them are set, otherwise clear them
export function groupToggleTarget(states: boolean[]): boolean {
  return states.filter(Boolean).length * 2 <= states.length;
}

// gutter mousedown handler: keep focus in the editor (instead of the gutter)
export function focusOnGutterMouseDown(view: EditorView): boolean {
  view.focus();
  return true;
}

// view plugin that shows decorations made by build(); setup() is called for each
// view and returns build() and needsRebuild() (whether an update changes them)
export function decorationsPlugin(
  setup: () => { build: (view: EditorView) => DecorationSet; needsRebuild: (update: ViewUpdate) => boolean },
  eventHandlers?: DOMEventHandlers<{ decorations: DecorationSet }>,
) {
  return ViewPlugin.define(
    (view) => {
      const { build, needsRebuild } = setup();
      return {
        decorations: build(view),
        update(update: ViewUpdate) {
          if (needsRebuild(update)) {
            this.decorations = build(update.view);
          }
        },
      };
    },
    { decorations: (plugin) => plugin.decorations, eventHandlers },
  );
}

// update changed the document, the visible part of it or the syntax tree
export function docViewOrTreeChanged(update: ViewUpdate): boolean {
  return update.docChanged || update.viewportChanged || syntaxTree(update.state) !== syntaxTree(update.startState);
}
