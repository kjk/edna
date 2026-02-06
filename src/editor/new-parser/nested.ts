/**
 * Nested language parsing for syntax highlighting.
 * Configures parseMixed to apply language-specific parsers to NoteContent nodes.
 */

import { parseMixed } from "@lezer/common";
import { NodeID } from "./node-types";
import { langGetParser, LANGUAGES } from "../languages";

// Pre-build the language mapping: token → parser
const languageMapping = Object.fromEntries(
  LANGUAGES.map((l) => [l.token, langGetParser(l)]),
);

/**
 * Configure nested language parsing.
 * Returns a parseMixed configuration that applies the appropriate
 * language parser to each block's content based on its language tag.
 */
export function configureNesting() {
  return parseMixed((node, input) => {
    // Only handle NoteContent nodes
    if (node.type.id !== NodeID.NoteContent) {
      return null;
    }

    // Don't parse empty content (causes issues with some StreamLanguage parsers)
    if (node.from === node.to) {
      return null;
    }

    // Get the parent Note node and find the NoteLanguage child
    const noteNode = node.node.parent;
    if (!noteNode) {
      return null;
    }

    // Find the NoteDelimiter child, then get NoteLanguage from it
    const delimiterNode = noteNode.firstChild;
    if (!delimiterNode) {
      return null;
    }

    // Get NoteLanguage from the delimiter
    const langNodes = delimiterNode.getChildren(NodeID.NoteLanguage);
    const langNode = langNodes[0];
    if (!langNode) {
      return null;
    }

    // Read the language name from the input
    const langName = input.read(langNode.from, langNode.to);

    // Look up the parser for this language
    const parser = languageMapping[langName];
    if (!parser) {
      return null;
    }

    // Return the nested parser configuration
    return {
      parser,
      overlay: [{ from: node.from, to: node.to }],
    };
  });
}
