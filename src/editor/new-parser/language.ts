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
import { contentFoldRange } from "../constants";
import { parser } from "./parser";
import { configureNesting } from "./nested";

// Language data configuration
const languageData = defineLanguageFacet({
  commentTokens: { line: "//" },
});

// Configure folding and nested language parsing
const parserWithProps = parser.configure({
  props: [
    foldNodeProp.add({
      NoteContent(node, state) {
        return contentFoldRange(state.doc, node.from, node.to, true);
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
