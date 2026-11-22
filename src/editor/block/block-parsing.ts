import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { IterMode } from "@lezer/common";
import { DELIMITER_PREFIX, parseDelimiterLine } from "../new-parser/node-types";

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
 * Return a list of blocks from the syntax tree produced by the parser
 * in src/editor/new-parser. There is no "Auto" node, so auto-detect is
 * determined by checking for "-a" after the language token in the delimiter text.
 * syntaxTreeAvailable() should have been called before this function to ensure the syntax tree is available.
 */
export function getBlocksFromSyntaxTree(state: EditorState): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  const tree = syntaxTree(state);
  if (!tree) {
    return blocks;
  }
  tree.iterate({
    enter: (type) => {
      if (type.name === "Document" || type.name === "Note") {
        return true;
      } else if (type.name === "NoteDelimiter") {
        const langNode = type.node.getChild("NoteLanguage");
        if (!langNode) return false;
        const language = state.doc.sliceString(langNode.from, langNode.to);
        // New parser has no Auto node — check for "-a" suffix after language token
        const afterLang = state.doc.sliceString(langNode.to, type.to);
        const isAuto = afterLang.startsWith("-a");
        const contentNode = type.node.nextSibling;
        if (contentNode) {
          blocks.push({
            index: blocks.length,
            language: language,
            autoDetect: isAuto,
            from: type.from,
            to: contentNode.to,
            contentFrom: contentNode.from,
          });
        } else {
          // Empty block: new parser omits NoteContent when content is empty
          blocks.push({
            index: blocks.length,
            language: language,
            autoDetect: isAuto,
            from: type.from,
            to: type.to,
            contentFrom: type.to,
          });
        }
        return false;
      }
      return false;
    },
    mode: IterMode.IgnoreMounts,
  });
  firstBlockDelimiterSize = blocks[0]?.contentFrom;
  return blocks;
}

// returns position of the next valid delimiter ("\n∞∞∞lang\n") at or after pos, -1 if none
function findNextDelimiter(s: string, pos: number): number {
  const delim = "\n" + DELIMITER_PREFIX;
  while (true) {
    const idx = s.indexOf(delim, pos);
    if (idx < 0) {
      return -1;
    }
    const lineEnd = s.indexOf("\n", idx + 1);
    if (lineEnd >= 0 && parseDelimiterLine(s.substring(idx + 1, lineEnd))) {
      return idx;
    }
    pos = idx + 1;
  }
}

/**
 * Parse blocks from document's string contents using String.indexOf()
 */
export function getBlocksFromString(s: string): NoteBlock[] {
  //const timer = startTimer()
  const blocks: NoteBlock[] = [];
  const sLen = s.length;
  let pos = 0;
  while (pos < sLen) {
    const blockStart = findNextDelimiter(s, pos);
    if (blockStart != pos) {
      console.error("Error parsing blocks, expected delimiter at", pos);
      break;
    }
    const delimiterEnd = s.indexOf("\n", blockStart + 1);
    const { language: lang, autoDetect: auto } = parseDelimiterLine(s.substring(blockStart + 1, delimiterEnd))!;
    const contentFrom = delimiterEnd + 1;
    let blockEnd = findNextDelimiter(s, contentFrom);
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
