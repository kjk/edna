import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType, type DecorationSet } from "@codemirror/view";
import { CURRENCIES_LOADED, transactionsHasAnnotation } from "../annotation";
import { getNoteBlockFromPos } from "./block";

declare const math: { format: (result: unknown, options?: object) => string };

class MathResult extends WidgetType {
  displayResult: string;
  copyResult: string;

  constructor(displayResult: string, copyResult: string) {
    super();
    this.displayResult = displayResult;
    this.copyResult = copyResult;
  }

  eq(other: MathResult): boolean {
    return other.displayResult == this.displayResult;
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "heynote-math-result";
    const inner = document.createElement("span");
    inner.className = "inner";
    inner.innerHTML = this.displayResult;
    wrap.appendChild(inner);
    inner.addEventListener("click", (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(this.copyResult);
      const copyElement = document.createElement("i");
      copyElement.className = "heynote-math-result-copied";
      copyElement.innerHTML = "Copied!";
      wrap.appendChild(copyElement);
      copyElement.offsetWidth; // trigger reflow so that the animation is shown
      copyElement.className = "heynote-math-result-copied fade-out";
      setTimeout(() => {
        copyElement.remove();
      }, 1700);
    });
    return wrap;
  }
  ignoreEvent() {
    return false;
  }
}

interface MathParser {
  parser: { evaluate: (s: string) => unknown; get: (s: string) => unknown; set: (s: string, v: unknown) => void };
  prev: unknown;
}

function mathDeco(view: EditorView): DecorationSet {
  let mathParsers = new WeakMap<object, MathParser>();
  let builder = new RangeSetBuilder<Decoration>();
  for (let { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      let line = view.state.doc.lineAt(pos);
      var block = getNoteBlockFromPos(view.state, pos);

      if (block && block.language == "math") {
        // get math.js parser and cache it for this block
        let cached = mathParsers.get(block);
        let parser = cached?.parser;
        let prev = cached?.prev;
        if (!parser) {
          parser = (window as unknown as { math: { parser: () => MathParser["parser"] } }).math.parser();
          mathParsers.set(block, { parser, prev });
        }

        // evaluate math line
        let result;
        try {
          parser.set("prev", prev);
          result = parser.evaluate(line.text);
          if (result !== undefined) {
            mathParsers.set(block, { parser, prev: result });
          }
        } catch (e) {
          // suppress any errors
        }

        // if we got a result from math.js, add the result decoration
        if (result !== undefined) {
          let format = parser.get("format");

          let resultWidget;
          if (typeof result === "string") {
            resultWidget = new MathResult(result, result);
          } else if (format !== undefined && typeof format === "function") {
            try {
              resultWidget = new MathResult(format(result), format(result));
            } catch (e) {
              // suppress any errors
            }
          }
          if (resultWidget === undefined) {
            resultWidget = new MathResult(
              math.format(result, {
                precision: 8,
                upperExp: 8,
                lowerExp: -6,
              }),
              math.format(result, {
                notation: "fixed",
              }),
            );
          }
          builder.add(
            line.to,
            line.to,
            Decoration.widget({
              widget: resultWidget,
              side: 1,
            }),
          );
        }
      }
      pos = line.to + 1;
    }
  }
  return builder.finish() as DecorationSet;
}

export const mathBlock = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = mathDeco(view);
    }

    update(update: ViewUpdate) {
      // If the document changed, the viewport changed, or the transaction was annotated with the CURRENCIES_LOADED annotation,
      // update the decorations. The reason we need to check for CURRENCIES_LOADED annotations is because the currency rates are
      // updated asynchronously
      if (
        update.docChanged ||
        update.viewportChanged ||
        transactionsHasAnnotation(update.transactions, CURRENCIES_LOADED)
      ) {
        this.decorations = mathDeco(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
