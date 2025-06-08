import { kDefaultFontFamily, kDefaultFontSize } from "../../settings.svelte";

import { EditorView } from "@codemirror/view";

export function getFontTheme(fontFamily, fontSize) {
  fontSize = fontSize || kDefaultFontSize;

  fontFamily = fontFamily || kDefaultFontFamily;
  // quote fontFamily name in case it has spaces in it
  // provide monospace fallback if the font doesn't exist (e.g. Linux)
  fontFamily = `'${fontFamily}', monospace`;
  // console.log("getFontTheme:", fontFamily);

  return EditorView.theme({
    ".cm-scroller": {
      fontFamily: fontFamily,
      fontSize: fontSize + "px",
    },
  });
}
