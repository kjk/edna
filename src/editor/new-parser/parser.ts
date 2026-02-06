/**
 * Hand-written Lezer parser for multi-block documents.
 *
 * Parses documents with block delimiters in the format:
 *   ∞∞∞{language}[-a]
 *   {content}
 *
 * This replaces the grammar-generated parser with a manual implementation
 * that extends Lezer's Parser class.
 */

import {
  Parser,
  Tree,
  TreeFragment,
  NodeSet,
  type NodePropSource,
  type PartialParse,
  type Input,
  type ParseWrapper,
} from "@lezer/common";
import { NodeID, nodeSet, DELIMITER_PREFIX } from "./node-types";

/**
 * Find all delimiter positions in the input text.
 * Returns array of {start, end, langStart, langEnd, autoDetect}
 */
interface DelimiterInfo {
  start: number; // Start of delimiter (including leading newline if present)
  end: number; // End of delimiter (after trailing newline)
  langStart: number; // Start of language token
  langEnd: number; // End of language token
  autoDetect: boolean; // Whether -a suffix is present
}

function findDelimiters(text: string): DelimiterInfo[] {
  const delimiters: DelimiterInfo[] = [];
  let pos = 0;

  // Check for delimiter at document start (no leading newline)
  if (text.startsWith(DELIMITER_PREFIX)) {
    const lineEnd = text.indexOf("\n");
    if (lineEnd !== -1) {
      const delimLine = text.slice(0, lineEnd);
      const langMatch = delimLine.slice(DELIMITER_PREFIX.length);
      const autoDetect = langMatch.endsWith("-a");
      const lang = autoDetect ? langMatch.slice(0, -2) : langMatch;
      if (lang.length > 0 && /^[a-z]+$/.test(lang)) {
        delimiters.push({
          start: 0,
          end: lineEnd + 1,
          langStart: DELIMITER_PREFIX.length,
          langEnd: DELIMITER_PREFIX.length + lang.length,
          autoDetect,
        });
      }
    }
    pos = text.indexOf("\n") + 1;
  }

  // Find remaining delimiters (with leading newline)
  while (pos < text.length) {
    const nextNewline = text.indexOf("\n", pos);
    if (nextNewline === -1) break;

    // Check if next line starts with delimiter
    const afterNewline = nextNewline + 1;
    if (
      text.slice(afterNewline, afterNewline + DELIMITER_PREFIX.length) ===
      DELIMITER_PREFIX
    ) {
      const lineEnd = text.indexOf("\n", afterNewline);
      if (lineEnd !== -1) {
        const delimLine = text.slice(afterNewline, lineEnd);
        const langMatch = delimLine.slice(DELIMITER_PREFIX.length);
        const autoDetect = langMatch.endsWith("-a");
        const lang = autoDetect ? langMatch.slice(0, -2) : langMatch;
        if (lang.length > 0 && /^[a-z]+$/.test(lang)) {
          delimiters.push({
            start: nextNewline, // Include the newline before ∞∞∞
            end: lineEnd + 1, // Include the newline after language
            langStart: afterNewline + DELIMITER_PREFIX.length,
            langEnd: afterNewline + DELIMITER_PREFIX.length + lang.length,
            autoDetect,
          });
          pos = lineEnd + 1;
          continue;
        }
      }
    }
    pos = nextNewline + 1;
  }

  return delimiters;
}

/**
 * Custom partial parse implementation.
 */
class MultiBlockParse implements PartialParse {
  private done = false;
  private tree: Tree | null = null;

  constructor(
    private input: Input,
    private fragments: readonly TreeFragment[],
    private ranges: readonly { from: number; to: number }[]
  ) {}

  advance(): Tree | null {
    if (this.done) return this.tree;

    const text = this.input.read(0, this.input.length);
    this.tree = this.parseDocument(text);
    this.done = true;
    return this.tree;
  }

  private parseDocument(text: string): Tree {
    const delimiters = findDelimiters(text);

    const docType = nodeSet.types[NodeID.Document];
    if (delimiters.length === 0 || !docType) {
      // No blocks found - create empty document
      return Tree.empty;
    }

    const notes: Tree[] = [];
    const notePositions: number[] = [];

    for (let i = 0; i < delimiters.length; i++) {
      const delim = delimiters[i];
      if (!delim) continue;

      const nextDelim = delimiters[i + 1];

      // Determine content range
      const contentStart = delim.end;
      const contentEnd = nextDelim ? nextDelim.start : text.length;

      // Build the Note subtree
      const noteTree = this.buildNote(delim, contentStart, contentEnd);
      notes.push(noteTree);
      notePositions.push(delim.start);
    }

    return new Tree(docType, notes, notePositions, text.length);
  }

  private buildNote(
    delim: DelimiterInfo,
    contentStart: number,
    contentEnd: number
  ): Tree {
    const langType = nodeSet.types[NodeID.NoteLanguage];
    const delimType = nodeSet.types[NodeID.NoteDelimiter];
    const contentType = nodeSet.types[NodeID.NoteContent];
    const noteType = nodeSet.types[NodeID.Note];

    // Build NoteLanguage node
    const langTree = langType
      ? new Tree(langType, [], [], delim.langEnd - delim.langStart)
      : Tree.empty;

    // Build NoteDelimiter with NoteLanguage child
    const delimTree = delimType
      ? new Tree(
          delimType,
          [langTree],
          [delim.langStart - delim.start],
          delim.end - delim.start
        )
      : Tree.empty;

    // Build NoteContent node
    const contentTree = contentType
      ? new Tree(contentType, [], [], contentEnd - contentStart)
      : Tree.empty;

    // Build Note with delimiter and content
    const children: Tree[] = [delimTree];
    const positions: number[] = [0];

    if (contentEnd > contentStart) {
      children.push(contentTree);
      positions.push(delim.end - delim.start);
    }

    return noteType
      ? new Tree(noteType, children, positions, contentEnd - delim.start)
      : Tree.empty;
  }

  get parsedPos(): number {
    return this.done ? this.input.length : 0;
  }

  get stoppedAt(): number | null {
    return null;
  }

  stopAt(_pos: number): void {
    // Not implemented for this simple parser
  }
}

/**
 * The main multi-block document parser.
 * Extends Lezer's Parser class with custom parsing logic.
 */
export class MultiBlockParser extends Parser {
  private _nodeSet: NodeSet;
  private _wrap: ParseWrapper | null;

  constructor(configuredNodeSet?: NodeSet, wrap?: ParseWrapper | null) {
    super();
    this._nodeSet = configuredNodeSet || nodeSet;
    this._wrap = wrap || null;
  }

  createParse(
    input: Input,
    fragments: readonly TreeFragment[],
    ranges: readonly { from: number; to: number }[]
  ): PartialParse {
    const baseParse = new MultiBlockParse(input, fragments, ranges);

    // If we have a wrapper (e.g., from parseMixed), apply it
    if (this._wrap) {
      return this._wrap(baseParse, input, fragments, ranges);
    }

    return baseParse;
  }

  configure(config: { props?: readonly NodePropSource[]; wrap?: ParseWrapper }): MultiBlockParser {
    let newNodeSet = this._nodeSet;
    let newWrap = this._wrap;

    // Apply props to create a new NodeSet
    if (config.props && config.props.length > 0) {
      newNodeSet = this._nodeSet.extend(...config.props);
    }

    // Store the wrap function
    if (config.wrap) {
      newWrap = config.wrap;
    }

    return new MultiBlockParser(newNodeSet, newWrap);
  }

  get nodeSet(): NodeSet {
    return this._nodeSet;
  }
}

// Export singleton instance
export const parser = new MultiBlockParser();
