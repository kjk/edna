import { foldedRanges } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import { CURRENCIES_LOADED, transactionsHasAnnotation } from "../annotation";
import { getNoteBlocksBetween } from "./block";

interface MathAPI {
  evaluate(expression: string, scope: Map<string, unknown>): unknown;
  format(
    value: unknown,
    options: { precision?: number; notation?: string; upperExp?: number; lowerExp?: number },
  ): string;
}

interface Result {
  pos: number;
  label: string;
  full: string;
}

interface Evaluation {
  scope: Map<string, unknown>;
  nextLine: number;
  results: Result[];
}

function formatResult(math: MathAPI, value: unknown, custom: unknown): { label: string; full: string } {
  if (typeof value === "string") return { label: value, full: value };
  if (typeof custom === "function") {
    try {
      const label = String(custom(value));
      return { label, full: label };
    } catch {
      // A format function may only accept some result types.
    }
  }
  return {
    label: math.format(value, { precision: 8, upperExp: 8, lowerExp: -6 }),
    full: math.format(value, { notation: "fixed" }),
  };
}

function evaluate(view: EditorView, evaluations: Map<number, Evaluation>): Result[] {
  const math = (view.dom.ownerDocument.defaultView as (Window & { math?: MathAPI }) | null)?.math;
  if (!math) return [];

  const { state, viewport } = view;
  const results: Result[] = [];
  for (const block of getNoteBlocksBetween(state, viewport.from, viewport.to)) {
    if (block.language !== "math") continue;
    let evaluation = evaluations.get(block.from);
    if (!evaluation) {
      evaluation = { scope: new Map(), nextLine: state.doc.lineAt(block.contentFrom).number, results: [] };
      evaluations.set(block.from, evaluation);
    }

    const last = state.doc.lineAt(Math.min(block.to, viewport.to)).number;
    const { scope } = evaluation;
    for (let n = evaluation.nextLine; n <= last; n++) {
      const line = state.doc.line(n);
      const from = Math.max(block.contentFrom, line.from);
      const to = Math.min(block.to, line.to);
      const expression = state.sliceDoc(from, to);
      if (!expression.trim() || /^\s*#/.test(expression)) continue;

      try {
        const value = math.evaluate(expression, scope);
        if (value === undefined || typeof value === "function") continue;
        scope.set("prev", value);
        const { label, full } = formatResult(math, value, scope.get("format"));
        if (label) evaluation.results.push({ pos: to, label, full });
      } catch {
        // An incomplete expression does not interrupt later lines.
      }
    }
    evaluation.nextLine = Math.max(evaluation.nextLine, last + 1);
    const from = state.doc.lineAt(viewport.from).from;
    for (const result of evaluation.results) {
      if (result.pos >= from && result.pos <= viewport.to) results.push(result);
    }
  }
  return results;
}

class MathResult extends WidgetType {
  constructor(
    readonly label: string,
    readonly full: string,
  ) {
    super();
  }

  eq(other: MathResult) {
    return this.label === other.label && this.full === other.full;
  }

  toDOM(view: EditorView) {
    const { ownerDocument } = view.dom;
    const wrapper = ownerDocument.createElement("span");
    wrapper.className = "heynote-math-result";
    const inner = wrapper.appendChild(ownerDocument.createElement("span"));
    inner.className = "inner";
    inner.textContent = this.label;
    inner.title = "Copy result";
    inner.onmousedown = (event) => event.preventDefault();
    inner.onclick = async () => {
      try {
        await ownerDocument.defaultView?.navigator.clipboard.writeText(this.full);
        inner.textContent = "Copied!";
        inner.classList.add("copied");
        setTimeout(() => {
          inner.textContent = this.label;
          inner.classList.remove("copied");
        }, 1000);
      } catch {
        inner.title = "Could not copy result";
      }
    };
    return wrapper;
  }
}

function visibleResults(view: EditorView, results: Result[]): DecorationSet {
  const folds = foldedRanges(view.state);
  const decorations = [];
  let i = 0;
  for (const { from, to } of view.visibleRanges) {
    while (i < results.length && results[i].pos < from) i++;
    while (i < results.length && results[i].pos <= to) {
      const result = results[i++];
      let hidden = false;
      folds.between(result.pos, result.pos, (from, to) => {
        if (from < result.pos && result.pos <= to) hidden = true;
      });
      if (!hidden) {
        decorations.push(
          Decoration.widget({ widget: new MathResult(result.label, result.full), side: 1 }).range(result.pos),
        );
      }
    }
  }
  return Decoration.set(decorations);
}

export const mathBlock = ViewPlugin.define(
  (view) => {
    const evaluations = new Map<number, Evaluation>();
    return {
      decorations: visibleResults(view, evaluate(view, evaluations)),
      update(update) {
        const refresh = update.docChanged || transactionsHasAnnotation(update.transactions, CURRENCIES_LOADED);
        if (refresh) evaluations.clear();
        if (refresh || update.viewportChanged || foldedRanges(update.state) !== foldedRanges(update.startState)) {
          this.decorations = visibleResults(update.view, evaluate(update.view, evaluations));
        }
      },
    };
  },
  { decorations: (plugin) => plugin.decorations },
);
