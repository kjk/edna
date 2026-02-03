import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { kDefaultFontFamily, kDefaultFontSize } from "../../settings.svelte";

/**
 * Check if the given font family is monospace by drawing test characters on a canvas
 */
function isMonospace(fontFamily: string) {
  const testCharacters = ["i", "W", "m", " "];
  const testSize = "72px";

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${testSize} ${fontFamily}`;

  const widths = testCharacters.map((char) => context.measureText(char).width);
  let res = widths.every((width) => width === widths[0]);
  // console.log(`isMonospace("${fontFamily}"): ${res}`);
  return res;
}

export const isMonospaceFont = Facet.define({
  combine: (values) => (values.length ? values[0] : true),
});

let hardcodedMonospace = ["hack", "Cascadia Code", "Consolas", "monospace"];

export function getFontTheme(fontFamily: string, fontSize: number) {
  fontSize = fontSize || kDefaultFontSize;

  // quote fontFamily name in case it has spaces in it
  // provide monospace fallback if the font doesn't exist (e.g. Linux)
  // fontFamily = `'${fontFamily}', monospace`;
  // console.log("getFontTheme:", fontFamily);
  const computedFontFamily = fontFamily || kDefaultFontFamily;

  return [
    EditorView.theme({
      ".cm-scroller": {
        fontFamily: computedFontFamily,
        fontSize: fontSize + "px",
      },
    }),
    // in order to avoid a short flicker when the program is loaded with the default font (Hack),
    // we hardcode Hack to be monospace
    isMonospaceFont.of(hardcodedMonospace.includes(computedFontFamily) ? true : isMonospace(computedFontFamily)),
  ];
}
