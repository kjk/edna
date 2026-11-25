import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { getBlocksFromString, parseDelimiterLine, type NoteBlock } from "../../block-format";
import { NodeID } from "../new-parser/node-types";

export function getBlocksFromSyntaxTree(state: EditorState): NoteBlock[] {
  const tree = syntaxTree(state);
  if (tree.length !== state.doc.length || tree.type.id !== NodeID.Document) {
    return getBlocksFromString(state.doc.toString());
  }

  const blocks: NoteBlock[] = [];
  for (let note = tree.topNode.firstChild; note; note = note.nextSibling) {
    const delimiter = note.getChild(NodeID.NoteDelimiter);
    if (!delimiter) continue;
    const from = delimiter.from + Number(state.sliceDoc(delimiter.from, delimiter.from + 1) === "\n");
    const header = parseDelimiterLine(state.sliceDoc(from, delimiter.to - 1));
    if (!header) continue;

    blocks.push({
      index: blocks.length,
      from: note.from,
      to: note.to,
      contentFrom: delimiter.to,
      language: header.language,
      autoDetect: header.autoDetect,
      ...(header.readOnly ? { readOnly: true } : {}),
    });
  }
  return blocks;
}
