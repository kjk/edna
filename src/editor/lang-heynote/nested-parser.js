import { parseMixed } from "@lezer/common";
import { getLanguage, langGetParser } from "../languages.js";
import { NoteContent, NoteLanguage } from "./parser.terms.js";

export function configureNesting() {
  // TODO: would have to by async to implement on-demand loading of parsers
  return parseMixed((node, input) => {
    let id = node.type.id;
    if (id == NoteContent) {
      let noteLang = node.node.parent.firstChild.getChildren(NoteLanguage)[0];
      let langName = input.read(noteLang?.from, noteLang?.to);

      // if the NoteContent is empty, we don't want to return a parser, since that seems to cause an
      // error for StreamLanguage parsers when the buffer size is large (e.g >300 kb)
      if (node.node.from == node.node.to) {
        return null;
      }
      const lang = getLanguage(langName);
      let res = langGetParser(lang);
      if (res) {
        // console.log("found parser for language:", langName, "res:", res);
        return {
          parser: res,
        };
      }
    }
    return null;
  });
}
