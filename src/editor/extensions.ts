import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { getActiveNoteBlock } from "./block/block";
import { hasSelection } from "./cmutils";

const defaultCloseBracketsConfig = {
  closeBrackets: {
    brackets: ["(", "[", "{", "'", '"'],
    before: ")]}:;>",
  },
};

const markdownCloseBracketsConfig = {
  closeBrackets: {
    brackets: ["(", "[", "{", "'", '"', "*", "_", "`"],
    before: ")]}:;>*_`",
  },
};

import type { Extension } from "@codemirror/state";

/**
 * Creates a dynamic close brackets extension that changes behavior based on the current block's language.
 */
export function createDynamicCloseBracketsExtension(): Extension {
  return [
    closeBrackets(),
    keymap.of(closeBracketsKeymap),
    EditorState.languageData.of((state) => {
      let block = getActiveNoteBlock(state);
      let isMarkdown = block && block.language === "markdown";
      let hasSel = hasSelection(state);
      if (isMarkdown && hasSel) {
        return [markdownCloseBracketsConfig];
      } else {
        return [defaultCloseBracketsConfig];
      }
    }),
  ];
}
