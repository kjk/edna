/**
 * Node type definitions for the multi-block document parser.
 *
 * Document structure:
 *   Document
 *     Note (one or more)
 *       NoteDelimiter (the ∞∞∞{lang}[-a] line)
 *       NoteContent (the block's text content)
 */

import { NodeType, NodeSet } from "@lezer/common";

// Node type IDs - must match array positions in nodeTypes
export const NodeID = {
  Document: 0,
  Note: 1,
  NoteDelimiter: 2,
  NoteContent: 3,
  NoteLanguage: 4,
} as const;

// Create node types - order must match NodeID values
const nodeTypes = [
  NodeType.define({ id: NodeID.Document, name: "Document", top: true }),
  NodeType.define({ id: NodeID.Note, name: "Note" }),
  NodeType.define({ id: NodeID.NoteDelimiter, name: "NoteDelimiter" }),
  NodeType.define({ id: NodeID.NoteContent, name: "NoteContent" }),
  NodeType.define({ id: NodeID.NoteLanguage, name: "NoteLanguage" }),
];

// Export the node set
export const nodeSet = new NodeSet(nodeTypes);

// Delimiter pattern: ∞∞∞ (three infinity symbols)
export const DELIMITER_PREFIX = "\u221e\u221e\u221e";

// This is the single definition of a valid block delimiter. A delimiter is a line
// ∞∞∞{language}[-a] where language is lowercase ascii letters and -a means
// auto-detect language. It must be preceded by a newline (except at the
// start of the document) and followed by a newline.

// matches a delimiter line (without the newlines)
export const delimiterLineRegex = /^\u221e\u221e\u221e([a-z]+)(-a)?$/;

// matches delimiters including surrounding newlines, for search / replace
export function delimiterRegexGlobal(): RegExp {
  return /\n\u221e\u221e\u221e[a-z]+(?:-a)?\n/g;
}

// parses a delimiter line (without the newlines). Returns null if not a valid delimiter
export function parseDelimiterLine(line: string): { language: string; autoDetect: boolean } | null {
  let m = delimiterLineRegex.exec(line);
  if (!m) {
    return null;
  }
  return { language: m[1]!, autoDetect: m[2] !== undefined };
}

