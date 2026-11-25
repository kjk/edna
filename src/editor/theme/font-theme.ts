import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const isMonospaceFont = Facet.define<boolean, boolean>({
  combine: (values) => values[0] ?? true,
});

export function getFontTheme(fontFamily: string, fontSize: number) {
  const family = fontFamily || "monospace";
  const size = fontSize || 14;
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
