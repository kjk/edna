import { json } from "@codemirror/lang-json";
import { foldNodeProp, LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { FOLD_LABEL_LENGTH } from "../constants";
import { configureNesting } from "./nested-parser";
import { parser } from "./parser";

export const HeynoteLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        NoteDelimiter: t.tagName,
      }),

      foldNodeProp.add({
        //NoteContent: foldNode,
        //NoteContent: foldInside,
        NoteContent(node, state) {
          //return {from:node.from, to:node.to}
          return {
            from: Math.min(state.doc.lineAt(node.from).to, node.from + FOLD_LABEL_LENGTH),
            to: node.to,
          };
        },
      }),
    ],
    wrap: configureNesting(),
  }),
  languageData: {
    commentTokens: { line: ";" },
  },
});

export function heynoteLang() {
  let wrap = configureNesting();
  let lang = HeynoteLanguage.configure({ dialect: "", wrap: wrap });
  return [new LanguageSupport(lang, [json().support])];
}

/*export function heynote() {
    return new LanguageSupport(HeynoteLanguage)
}*/
