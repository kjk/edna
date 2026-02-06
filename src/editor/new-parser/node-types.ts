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

// Helper to get node type by ID
export function getNodeType(id: number): NodeType {
  return nodeSet.types[id] || NodeType.none;
}

// Delimiter pattern: ∞∞∞ (three infinity symbols)
export const DELIMITER_PREFIX = "\u221e\u221e\u221e";

// Full delimiter pattern for regex matching
// Matches: newline + ∞∞∞ + language + optional -a + newline
export const DELIMITER_REGEX = /\n(\u221e\u221e\u221e)([a-z]+)(-a)?\n/g;

// Pattern to match delimiter at start of document (no leading newline)
export const DELIMITER_START_REGEX = /^(\u221e\u221e\u221e)([a-z]+)(-a)?\n/;
