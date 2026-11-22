import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

let defaultFamily = "monospace";
let defaultSize = 14;

export function setDefaultFontFamilyAndSize(fontFamily: string, fontSize: number): void {
  defaultFamily = fontFamily;
  defaultSize = fontSize;
}

export const isMonospaceFont = Facet.define<boolean, boolean>({
  combine: (values) => values[0] ?? true,
});

export function getFontTheme(fontFamily: string, fontSize: number) {
  const family = fontFamily || defaultFamily;
  const size = fontSize || defaultSize;
  const cssFamily = `${family}, monospace`;
  const context = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  let monospace = true;
  if (context) {
    context.font = `${size}px ${cssFamily}`;
    monospace = Math.abs(context.measureText("iiiiiiii").width - context.measureText("WWWWWWWW").width) < 0.01;
  }
  return [
    isMonospaceFont.of(monospace),
    EditorView.theme({ "&": { fontSize: `${size}px` }, ".cm-scroller": { fontFamily: cssFamily } }),
  ];
}
