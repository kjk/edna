import { parseMixed } from "@lezer/common";
import { getLanguage, langGetParser, LANGUAGES } from "../languages";
import { NoteContent, NoteLanguage } from "./parser.terms";

const languageMapping = Object.fromEntries(
  LANGUAGES.map((l) => [l.token, langGetParser(l)]),
);

export function configureNesting() {
  // TODO: would have to by async to implement on-demand loading of parsers
  return parseMixed((node, input) => {
    let id = node.type.id;
    if (id == NoteContent) {
      let noteLang = node.node.parent?.firstChild?.getChildren(NoteLanguage)[0];
      if (!noteLang) return null;
      let langName = input.read(noteLang.from, noteLang.to);

      // if the NoteContent is empty, we don't want to return a parser, since that seems to cause an
      // error for StreamLanguage parsers when the buffer size is large (e.g >300 kb)
      if (node.node.from == node.node.to) {
        return null;
      }

      if (langName in languageMapping && languageMapping[langName] !== null) {
        //console.log("found parser for language:", langName)
        return {
          parser: languageMapping[langName],
          overlay: [{ from: node.from, to: node.to }],
        };
      }
    }
    return null;
  });
}
