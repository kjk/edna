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
  // only set (to true) for read-only blocks (#57)
  readOnly?: boolean;
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

    // e.g. "-a-ro\n"
    const suffix = state.sliceDoc(token.to, delimiter.to);
    const block: NoteBlock = {
      index: blocks.length,
      from: note.from,
      to: note.to,
      contentFrom: delimiter.to,
      language: state.sliceDoc(token.from, token.to),
      autoDetect: suffix.startsWith("-a"),
    };
    if (suffix.trimEnd().endsWith("-ro")) block.readOnly = true;
    blocks.push(block);
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
    ...(delimiter.readOnly ? { readOnly: true } : {}),
  }));
}
