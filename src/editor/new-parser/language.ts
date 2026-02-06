/**
 * CodeMirror language definition using the hand-written parser.
 * Sets up the Language with proper configuration for syntax highlighting
 * and code folding support.
 */

import {
  Language,
  LanguageSupport,
  defineLanguageFacet,
  languageDataProp,
  foldNodeProp,
} from "@codemirror/language";
import { parser } from "./parser";
import { configureNesting } from "./nested";

// Number of characters to show before folding starts
const FOLD_LABEL_LENGTH = 50;

// Language data configuration
const languageData = defineLanguageFacet({
  commentTokens: { line: "//" },
});

// Configure folding and nested language parsing
const parserWithProps = parser.configure({
  props: [
    foldNodeProp.add({
      NoteContent(node, state) {
        if (node.from >= node.to) return null;

        const firstLine = state.doc.lineAt(node.from);
        const foldFrom = Math.min(firstLine.to, node.from + FOLD_LABEL_LENGTH);

        if (foldFrom >= node.to) return null;

        return { from: foldFrom, to: node.to };
      },
    }),
    languageDataProp.add({
      Document: languageData,
    }),
  ],
  wrap: configureNesting(),
});

/**
 * The multi-block language definition.
 */
export const multiBlockLanguage = new Language(
  languageData,
  parserWithProps,
  [],
  "multiblock"
);

/**
 * Full language support including the language and any extensions.
 */
export function multiBlock(): LanguageSupport {
  return new LanguageSupport(multiBlockLanguage);
}
