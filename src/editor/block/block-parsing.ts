import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { IterMode } from "@lezer/common";
import { findDelimiters } from "../new-parser/parser";

export interface NoteBlock {
  index: number;
  from: number;
  to: number;
  contentFrom: number;
  language: string;
  autoDetect: boolean;
}

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
  return blocks;
}

/**
 * Parse blocks from document's string contents. Uses the same delimiter scan as
 * the parser so the blocks are the same as getBlocksFromSyntaxTree() for any
 * text, including malformed text (U26): a delimiter at the start without a
 * leading newline is accepted, text before the first delimiter is in no block.
 */
export function getBlocksFromString(s: string): NoteBlock[] {
  const delimiters = findDelimiters(s);
  const blocks: NoteBlock[] = [];
  for (let i = 0; i < delimiters.length; i++) {
    const d = delimiters[i]!;
    const next = delimiters[i + 1];
    blocks.push({
      index: i,
      language: s.substring(d.langStart, d.langEnd),
      autoDetect: d.autoDetect,
      from: d.start,
      to: next ? next.start : s.length,
      contentFrom: d.end,
    });
  }
  //console.log("getBlocksFromString() took", timer(), "ms")
  return blocks;
}
