import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { IterMode } from "@lezer/common";
import { Document, Note, NoteDelimiter } from "../lang-heynote/parser.terms";

export interface NoteBlock {
  index: number;
  from: number;
  to: number;
  contentFrom: number;
  language: string;
  autoDetect: boolean;
}

// tracks the size of the first delimiter
export let firstBlockDelimiterSize: number | undefined;

/**
 * Return a list of blocks in the document from the syntax tree.
 * syntaxTreeAvailable() should have been called before this function to ensure the syntax tree is available.
 */
export function getBlocksFromSyntaxTree(state: EditorState): NoteBlock[] {
  //const timer = startTimer()
  const blocks: NoteBlock[] = [];
  const tree = syntaxTree(state);
  if (!tree) {
    return blocks;
  }
  tree.iterate({
    enter: (type) => {
      if (type.type.id == Document || type.type.id == Note) {
        return true;
      } else if (type.type.id === NoteDelimiter) {
        const langNode = type.node.getChild("NoteLanguage");
        if (!langNode) return false;
        const language = state.doc.sliceString(langNode.from, langNode.to);
        const isAuto = !!type.node.getChild("Auto");
        const contentNode = type.node.nextSibling;
        if (!contentNode) return false;
        blocks.push({
          index: blocks.length,
          language: language,
          autoDetect: isAuto,
          from: type.node.from,
          to: contentNode.to,
          contentFrom: contentNode.from,
        });
        return false;
      }
      return false;
    },
    mode: IterMode.IgnoreMounts,
  });
  firstBlockDelimiterSize = blocks[0]?.contentFrom;
  //console.log("getBlocksSyntaxTree took", timer(), "ms")
  return blocks;
}

/**
 * Parse blocks from document's string contents using String.indexOf()
 */
export function getBlocksFromString(s: string): NoteBlock[] {
  //const timer = startTimer()
  const blocks: NoteBlock[] = [];
  const sLen = s.length;
  const delim = "\n∞∞∞";
  let pos = 0;
  while (pos < sLen) {
    const blockStart = s.indexOf(delim, pos);
    if (blockStart != pos) {
      console.error("Error parsing blocks, expected delimiter at", pos);
      break;
    }
    const langStart = blockStart + delim.length;
    const delimiterEnd = s.indexOf("\n", langStart);
    if (delimiterEnd < 0) {
      console.error("Error parsing blocks. Delimiter didn't end with newline");
      break;
    }
    const langFull = s.substring(langStart, delimiterEnd);
    let auto = false;
    let lang = langFull;
    if (langFull.endsWith("-a")) {
      auto = true;
      lang = langFull.substring(0, langFull.length - 2);
    }
    const contentFrom = delimiterEnd + 1;
    let blockEnd = s.indexOf(delim, contentFrom);
    if (blockEnd < 0) {
      blockEnd = sLen;
    }

    const block = {
      index: blocks.length,
      language: lang,
      autoDetect: auto,
      from: blockStart,
      to: blockEnd,
      contentFrom: contentFrom,
    };
    blocks.push(block);
    pos = blockEnd;
  }
  //console.log("getBlocksFromString() took", timer(), "ms")
  return blocks;
}
