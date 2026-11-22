import { RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType, type DecorationSet } from "@codemirror/view";
import { getNoteBlockFromPos } from "./block/block";

// Port of Heynote's color preview: shows a color swatch next to CSS colors

const colorStartBoundary = String.raw`(^|[^\w#])`; // before the color: start of text or not \w / #
const colorEndBoundary = String.raw`(?!\w)`; // after the color: not \w
const hexColor = String.raw`#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})`;
const rgbColor = String.raw`rgba?\([^()\n]*\)`;
const hslColor = String.raw`hsla?\([^()\n]*\)`;

const colorCandidateRegex = new RegExp(
  `${colorStartBoundary}(${[hexColor, rgbColor, hslColor].join("|")})${colorEndBoundary}`,
  "gi",
);

const previewLanguages = new Set(["css", "html", "javascript", "jsx", "typescript", "tsx", "vue", "svelte"]);

const validColorCache = new Map<string, boolean>();

function isValidCssColor(color: string): boolean {
  let ok = validColorCache.get(color);
  if (ok === undefined) {
    ok = window.CSS?.supports?.("color", color) ?? false;
    validColorCache.set(color, ok);
  }
  return ok;
}

function shouldPreviewColor(state: EditorState, pos: number): boolean {
  const block = getNoteBlockFromPos(state, pos);
  return !!block && previewLanguages.has(block.language);
}

class ColorPreviewWidget extends WidgetType {
  constructor(readonly color: string) {
    super();
  }

  eq(other: ColorPreviewWidget) {
    return other.color === this.color;
  }

  toDOM() {
    const swatch = document.createElement("span");
    swatch.className = "edna-color-preview";
    swatch.style.backgroundColor = this.color;
    swatch.title = this.color;
    swatch.setAttribute("aria-hidden", "true");
    return swatch;
  }

  ignoreEvent() {
    return true;
  }
}

function buildColorPreviewDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    let match: RegExpExecArray | null;
    colorCandidateRegex.lastIndex = 0;
    while ((match = colorCandidateRegex.exec(text)) !== null) {
      const color = match[2]!;
      if (!isValidCssColor(color)) {
        continue;
      }
      const pos = from + match.index + match[1]!.length;
      if (!shouldPreviewColor(view.state, pos)) {
        continue;
      }
      builder.add(pos, pos, Decoration.widget({ widget: new ColorPreviewWidget(color), side: 1 }));
    }
  }
  return builder.finish();
}

export const colorPreviewExtension = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildColorPreviewDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildColorPreviewDecorations(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  ),
  EditorView.baseTheme({
    ".edna-color-preview": {
      display: "inline-block",
      width: "0.8em",
      height: "0.8em",
      marginRight: "0.3em",
      border: "1px solid rgba(128,128,128,0.65)",
      borderRadius: "2px",
      boxSizing: "border-box",
      verticalAlign: "-0.08em",
    },
  }),
];
