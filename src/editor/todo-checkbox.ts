import type { ChangeSpec, EditorState, Line } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType, type DecorationSet } from "@codemirror/view";
import { SET_FONT, transactionsHasAnnotation } from "./annotation";
import { getNoteBlockFromPos } from "./block/block";
import { isMonospaceFont } from "./theme/font-theme";

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly monospace: boolean,
  ) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked == this.checked && other.monospace == this.monospace;
  }

  toDOM() {
    let wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.className = "cm-taskmarker-toggle";

    let box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.tabIndex = -1;
    box.style.margin = "0";
    box.style.padding = "0";

    if (this.monospace) {
      // if the font is monospaced, we'll set the content of the wrapper to "    " and the
      // position of the checkbox to absolute, since four spaces will be the same width
      // as the replaced "[ ] " / "[x] " so that characters on different lines will line up
      wrap.appendChild(document.createTextNode("    "));
      wrap.style.position = "relative";
      box.style.position = "absolute";
      box.style.top = "0";
      box.style.left = "0.25em";
      box.style.width = "1.1em";
      box.style.height = "1.1em";
    } else {
      // if the font isn't monospaced, we'll let the checkbox take up as much space as needed
      box.style.position = "relative";
      box.style.top = "0.1em";
      box.style.marginRight = "0.5em";
    }
    wrap.appendChild(box);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

const checkboxRegex = /^([\t\f\v ]*-[\t\f\v ]*)\[( |x|X)\] /gm;

function checkboxes(view: EditorView) {
  let widgets: any = [];

  for (let { from, to } of view.visibleRanges) {
    let range = view.state.sliceDoc(from, to);
    let match: RegExpExecArray | null;
    while ((match = checkboxRegex.exec(range)) !== null) {
      if (getNoteBlockFromPos(view.state, from + match.index)?.language === "markdown") {
        let deco = Decoration.replace({
          widget: new CheckboxWidget(match[2] === "x" || match[2] === "X", view.state.facet(isMonospaceFont)),
          inclusive: false,
        });
        widgets.push(deco.range(from + match.index + match[1]!.length, from + match.index + match[0].length));
      }
    }
  }
  return Decoration.set(widgets);
}

// pos is the start of "[ ] " / "[x] " (view.posAtDOM() of the widget returns its start)
function toggleBoolean(view: EditorView, pos: number) {
  // e.g. while code runs: the run's output would overwrite the change
  if (view.state.readOnly) {
    return false;
  }
  let s = view.state.doc.sliceString(pos, pos + 4).toLowerCase();
  let change: ChangeSpec;
  if (s === "[x] ") {
    change = { from: pos, to: pos + 4, insert: "[ ] " };
  } else if (s === "[ ] ") {
    change = { from: pos, to: pos + 4, insert: "[x] " };
  } else {
    return false;
  }
  view.dispatch({ changes: change });
  return true;
}

/**
 * A plugin that replaces [ ] and [x] with checkboxes to task list items in Markup mode
 */
export const todoCheckboxPlugin = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = checkboxes(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || transactionsHasAnnotation(update.transactions, SET_FONT)) {
          this.decorations = checkboxes(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,

      provide: (plugin) =>
        EditorView.atomicRanges.of((view: EditorView) => {
          return view.plugin(plugin)?.decorations || Decoration.none;
        }),

      eventHandlers: {
        mousedown: (e, view) => {
          let target = e.target as HTMLElement;
          if (target.nodeName == "INPUT" && target.parentElement!.classList.contains("cm-taskmarker-toggle"))
            return toggleBoolean(view, view.posAtDOM(target));
        },
      },
    },
  ),
];

const checkboxLineRegex = /^([\t\f\v ]*-[\t\f\v ]*)\[( |x|X)\] /;

interface CheckboxTarget {
  pos: number; // position of " " / "x" inside "[ ]"
  checked: boolean;
}

function checkboxTargetFromLine(state: EditorState, line: Line): CheckboxTarget | null {
  if (getNoteBlockFromPos(state, line.from)?.language !== "markdown") {
    return null;
  }
  const m = checkboxLineRegex.exec(line.text);
  if (!m) {
    return null;
  }
  return { pos: line.from + m[1]!.length + 1, checked: m[2] !== " " };
}

// lines touched by non-empty selection ranges or, if there are none, lines with a cursor
function linesForToggle(state: EditorState): Line[] {
  const ranges = state.selection.ranges;
  const hasSelection = ranges.some((r) => !r.empty);
  const res: Line[] = [];
  const seen = new Set<number>();
  for (const r of ranges) {
    if (hasSelection && r.empty) {
      continue;
    }
    const first = state.doc.lineAt(r.from).number;
    let last = state.doc.lineAt(r.to).number;
    // selection ending at the start of a line doesn't include that line
    if (!r.empty && r.to === state.doc.line(last).from && last > first) {
      last--;
    }
    for (let n = first; n <= last; n++) {
      if (!seen.has(n)) {
        seen.add(n);
        res.push(state.doc.line(n));
      }
    }
  }
  return res;
}

/**
 * Toggle "[ ]" / "[x]" todo checkboxes in markdown blocks on lines with a cursor
 * or in the selection. With a selection, all checkboxes are set to the same
 * state: checked unless most of them are already checked.
 */
export const toggleCheckbox = (view: EditorView): boolean => {
  const { state } = view;
  if (state.readOnly) {
    return false;
  }
  const targets: CheckboxTarget[] = [];
  for (const line of linesForToggle(state)) {
    const t = checkboxTargetFromLine(state, line);
    if (t) {
      targets.push(t);
    }
  }
  if (targets.length === 0) {
    return false;
  }
  let changes;
  if (state.selection.ranges.some((r) => !r.empty)) {
    const nChecked = targets.filter((t) => t.checked).length;
    const check = nChecked <= targets.length - nChecked;
    changes = targets.filter((t) => t.checked !== check).map((t) => ({ from: t.pos, to: t.pos + 1, insert: check ? "x" : " " }));
  } else {
    changes = targets.map((t) => ({ from: t.pos, to: t.pos + 1, insert: t.checked ? " " : "x" }));
  }
  if (changes.length > 0) {
    view.dispatch({ changes, userEvent: "input" });
  }
  return true;
};
