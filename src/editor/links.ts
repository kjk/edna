import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { isModKey, platform } from "../util";
import { decorationsPlugin } from "./cmutils";

const linkPattern = /https?:\/\/[^\s<>"'`]+/gi;

function linkDecorations(view: EditorView): DecorationSet {
  const decorations = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (const match of text.matchAll(linkPattern)) {
      let link = match[0].replace(/[.,:;!?]+$/, "");
      for (const [open, close] of [
        ["(", ")"],
        ["[", "]"],
        ["{", "}"],
      ]) {
        while (link.endsWith(close) && link.split(close).length > link.split(open).length) {
          link = link.slice(0, -1);
        }
      }
      if (!URL.canParse(link)) continue;
      const start = from + match.index;
      decorations.push(
        Decoration.mark({
          class: "edna-link",
          attributes: { "data-href": link, title: `${platform.isMac ? "Command" : "Ctrl"}+Click to open link` },
        }).range(start, start + link.length),
      );
    }
  }
  return Decoration.set(decorations, true);
}

export const links = decorationsPlugin(
  () => ({ build: linkDecorations, needsRebuild: (update) => update.docChanged || update.viewportChanged }),
  {
    click(event, view) {
      if (!isModKey(event) || event.button !== 0) return false;
      const anchor = (event.target as Element | null)?.closest<HTMLElement>(".edna-link");
      const href = anchor?.dataset.href;
      if (!href) return false;
      view.dom.ownerDocument.defaultView?.open(href, "_blank", "noopener,noreferrer");
      return true;
    },
  },
);
