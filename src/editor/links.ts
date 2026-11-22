import { Decoration, EditorView, ViewPlugin, type DecorationSet } from "@codemirror/view";
import { isMac } from "./cmutils";

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
          attributes: { "data-href": link, title: `${isMac() ? "Command" : "Ctrl"}+Click to open link` },
        }).range(start, start + link.length),
      );
    }
  }
  return Decoration.set(decorations, true);
}

export const links = ViewPlugin.define(
  (view) => ({
    links: linkDecorations(view),
    update(update) {
      if (update.docChanged || update.viewportChanged) this.links = linkDecorations(update.view);
    },
  }),
  {
    decorations: (plugin) => plugin.links,
    eventHandlers: {
      click(event, view) {
        if (!(isMac() ? event.metaKey : event.ctrlKey) || event.button !== 0) return false;
        const anchor = (event.target as Element | null)?.closest<HTMLElement>(".edna-link");
        const href = anchor?.dataset.href;
        if (!href) return false;
        view.dom.ownerDocument.defaultView?.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    },
  },
);
