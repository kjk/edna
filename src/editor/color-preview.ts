import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet } from "@codemirror/view";
import { getBlocks } from "./block/block";

const colorLanguages = new Set(["css", "html", "javascript", "jsx", "typescript", "tsx", "vue", "svelte"]);
const colorPattern =
  /(?<![-\w#])(?:#[\da-f]{8}|#[\da-f]{6}|#[\da-f]{4}|#[\da-f]{3})(?![-\w])|(?<![-\w])(?:rgba?|hsla?)\([^()\n]*\)/gi;

class ColorSwatch extends WidgetType {
  constructor(readonly color: string) {
    super();
  }

  eq(other: ColorSwatch) {
    return this.color === other.color;
  }

  toDOM(view: EditorView) {
    const swatch = view.dom.ownerDocument.createElement("span");
    swatch.className = "edna-color-preview";
    swatch.title = this.color;
    swatch.style.backgroundColor = this.color;
    return swatch;
  }
}

function swatches(view: EditorView): DecorationSet {
  const { state } = view;
  const ranges = [];
  for (const block of getBlocks(state)) {
    if (!colorLanguages.has(block.language)) continue;
    for (const visible of view.visibleRanges) {
      const from = Math.max(block.contentFrom, visible.from);
      const to = Math.min(block.to, visible.to);
      if (from >= to) continue;
      for (const match of state.sliceDoc(from, to).matchAll(colorPattern)) {
        const start = from + match.index;
        if (!CSS.supports("color", match[0])) continue;
        if (match[0].startsWith("#") && syntaxTree(state).resolveInner(start + 1).name === "IdName") continue;
        ranges.push(Decoration.widget({ widget: new ColorSwatch(match[0]), side: -1 }).range(start));
      }
    }
  }
  return Decoration.set(ranges, true);
}

export const colorPreviewExtension = [
  ViewPlugin.define(
    (view) => ({
      decorations: swatches(view),
      update(update) {
        if (update.docChanged || update.viewportChanged || syntaxTree(update.state) !== syntaxTree(update.startState))
          this.decorations = swatches(update.view);
      },
    }),
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    ".edna-color-preview": {
      display: "inline-block",
      width: "0.74em",
      height: "0.74em",
      verticalAlign: "baseline",
      border: "1px solid #8888",
      borderRadius: "2px",
      marginRight: "0.25em",
    },
  }),
];
