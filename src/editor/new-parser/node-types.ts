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

