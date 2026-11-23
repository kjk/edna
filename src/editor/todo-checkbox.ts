import { syntaxTree } from "@codemirror/language";
import type { ChangeSpec, EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import { NodeProp } from "@lezer/common";
import { getNoteBlocksBetween } from "./block/block";
import { groupToggleTarget } from "./cmutils";

interface TaskMarker {
  from: number;
  checked: boolean;
}

// change that sets task checkbox "[ ]" at from to checked or not
function checkboxChange(from: number, check: boolean): ChangeSpec {
  return { from: from + 1, to: from + 2, insert: check ? "x" : " " };
}

function markers(state: EditorState, from: number, to: number): TaskMarker[] {
  const tasks: TaskMarker[] = [];
  for (const block of getNoteBlocksBetween(state, from, to)) {
    if (block.language !== "markdown") continue;
    const content = syntaxTree(state).resolve(block.contentFrom, 1);
    const markdown = content.tree?.prop(NodeProp.mounted)?.tree;
    if (!markdown) continue;
    markdown.iterate({
      from: Math.max(0, from - block.contentFrom),
      to: Math.min(to, block.to) - block.contentFrom,
      enter(node) {
        const start = block.contentFrom + node.from;
        if (node.name === "TaskMarker" && start >= from && start + 3 <= to) {
          tasks.push({ from: start, checked: state.sliceDoc(start + 1, start + 2).toLowerCase() === "x" });
        }
      },
    });
  }
  return tasks;
}

class TaskCheckbox extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly readOnly: boolean,
  ) {
    super();
  }

  eq(other: TaskCheckbox) {
    return this.checked === other.checked && this.readOnly === other.readOnly;
  }

  toDOM(view: EditorView) {
    const box = view.dom.ownerDocument.createElement("input");
    box.type = "checkbox";
    box.className = "edna-todo-checkbox";
    box.checked = this.checked;
    box.setAttribute("aria-disabled", String(this.readOnly));
    box.tabIndex = -1;
    box.setAttribute("aria-label", "Markdown task");
    box.onmousedown = (event) => {
      event.preventDefault();
      view.focus();
    };
    box.onclick = (event) => {
      event.preventDefault();
      if (view.state.readOnly) return;
      const from = view.posAtDOM(box);
      view.dispatch({
        changes: checkboxChange(from, !this.checked),
        userEvent: "input",
      });
      view.focus();
    };
    return box;
  }
}

function widgets(view: EditorView): DecorationSet {
  const ranges = view.visibleRanges.flatMap(({ from, to }) =>
    markers(view.state, from, to).map(({ from, checked }) =>
      Decoration.replace({ widget: new TaskCheckbox(checked, view.state.readOnly) }).range(from, from + 3),
    ),
  );
  return Decoration.set(ranges, true);
}

export const todoCheckboxPlugin = [
  ViewPlugin.define(
    (view) => ({
      decorations: widgets(view),
      update(update) {
        if (
          update.viewportChanged ||
          update.docChanged ||
          update.state.readOnly !== update.startState.readOnly ||
          syntaxTree(update.state) !== syntaxTree(update.startState)
        ) {
          this.decorations = widgets(update.view);
        }
      },
    }),
    { decorations: (plugin) => plugin.decorations },
  ),
];

export function toggleCheckbox(view: EditorView): boolean {
  const { state } = view;
  if (state.readOnly) return false;
  const tasks = new Map<number, TaskMarker>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from);
    const last = state.doc.lineAt(range.empty ? range.to : range.to - 1);
    for (const task of markers(state, first.from, last.to)) tasks.set(task.from, task);
  }
  if (!tasks.size) return false;
  const check = groupToggleTarget([...tasks.values()].map((task) => task.checked));
  view.dispatch({
    changes: [...tasks.values()]
      .filter((task) => task.checked !== check)
      .map(({ from }) => checkboxChange(from, check)),
    userEvent: "input",
  });
  return true;
}
