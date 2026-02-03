import { Decoration, MatchDecorator, ViewPlugin } from "@codemirror/view";

import { platform } from "../util";

const modChar = platform.isMac ? "⌘" : "Ctrl";
const eventKeyModAttribute = platform.isMac ? "metaKey" : "ctrlKey";

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
    links;

    constructor(view) {
      this.links = linkMatcher.createDeco(view);
    }
    update(update) {
      this.links = linkMatcher.updateDeco(update, this.links);
    }
  },
  {
    decorations: (instance) => instance.links,
    eventHandlers: {
      click: (e, view) => {
        let target = /** @type {HTMLElement} */ (e.target);
        if (
          target.closest(".heynote-link")?.classList.contains("heynote-link") &&
          e[eventKeyModAttribute]
        ) {
          let linkEl = document.createElement("a");
          linkEl.href = target.textContent;
          linkEl.target = "_blank";
          linkEl.click();
          linkEl.remove();
        }
      },
    },
  }
);
