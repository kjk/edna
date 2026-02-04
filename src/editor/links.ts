import { Decoration, EditorView, MatchDecorator, ViewPlugin, ViewUpdate, type DecorationSet } from "@codemirror/view";
import { isMac } from "./cmutils";

const modChar = isMac() ? "⌘" : "Ctrl";
const eventKeyModAttribute = isMac() ? "metaKey" : "ctrlKey";

const linkMatcher = new MatchDecorator({
  regexp: /https?:\/\/[^\s\)]+/gi,
  decoration: (match) => {
    return Decoration.mark({
      class: "heynote-link",
      attributes: { title: `${modChar} + Click to open link` },
    });
  },
});

export const links = ViewPlugin.fromClass(
  class {
    links: DecorationSet;

    constructor(view: EditorView) {
      this.links = linkMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.links = linkMatcher.updateDeco(update, this.links);
    }
  },
  {
    decorations: (instance) => instance.links,
    eventHandlers: {
      click: (e, view) => {
        let target = e.target as HTMLElement;
        if (target.closest(".heynote-link")?.classList.contains("heynote-link") && e[eventKeyModAttribute]) {
          let linkEl = document.createElement("a");
          linkEl.href = target.textContent;
          linkEl.target = "_blank";
          linkEl.click();
          linkEl.remove();
        }
      },
    },
  },
);
