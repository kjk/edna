import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { NodeID } from "../new-parser/node-types";
import { findDelimiters } from "../new-parser/parser";

export interface NoteBlock {
  index: number;
  from: number;
  to: number;
  contentFrom: number;
  language: string;
  autoDetect: boolean;
}

export function getBlocksFromSyntaxTree(state: EditorState): NoteBlock[] {
  const tree = syntaxTree(state);
  if (tree.length !== state.doc.length || tree.type.id !== NodeID.Document) {
    return getBlocksFromString(state.doc.toString());
  }

  const blocks: NoteBlock[] = [];
  for (let note = tree.topNode.firstChild; note; note = note.nextSibling) {
    const delimiter = note.getChild(NodeID.NoteDelimiter);
    const token = delimiter?.getChild(NodeID.NoteLanguage);
    if (!delimiter || !token) continue;

    blocks.push({
      index: blocks.length,
      from: note.from,
      to: note.to,
      contentFrom: delimiter.to,
      language: state.sliceDoc(token.from, token.to),
      autoDetect: state.sliceDoc(token.to, delimiter.to).startsWith("-a"),
    });
  }
  return blocks;
}

export function getBlocksFromString(text: string): NoteBlock[] {
  const delimiters = findDelimiters(text);
  return delimiters.map((delimiter, index) => ({
    index,
    from: delimiter.start,
    to: delimiters[index + 1]?.start ?? text.length,
    contentFrom: delimiter.end,
    language: text.slice(delimiter.langStart, delimiter.langEnd),
    autoDetect: delimiter.autoDetect,
  }));
}
