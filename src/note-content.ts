import { blockHdrMarkdown } from "./constants";
import { delimiterLine, kDelimiterPrefix, parseDelimiterLine } from "./editor/new-parser/node-types";

// a line that looks like a delimiter but isn't valid: upper case language or
// Heynote metadata (∞∞∞text-a;created=...)
const reFixableDelimiterLine = /\n∞∞∞([A-Za-z]+)(-a)?(-ro)?(;[^\n]*)?(?=\n|$)/g;

/**
 * Makes stored note content a valid document (docs/state-machines.md U9):
 * - line endings are \n (the editor converts them; content read from storage
 *   and from the editor must be comparable)
 * - delimiter-like lines (upper case language, Heynote metadata) become valid
 *   delimiters instead of silently being block content
 * - it starts with a valid delimiter followed by a newline (otherwise there
 *   are no blocks, or text before the first block)
 */
export function fixUpNoteContent(s: string | null): string {
  if (s === null || s === "") {
    return blockHdrMarkdown;
  }
  if (s.includes("\r")) {
    s = s.replace(/\r\n?/g, "\n");
  }
  if (s.startsWith(kDelimiterPrefix)) {
    // legacy: first delimiter without the leading newline
    s = "\n" + s;
  }
  s = s.replace(reFixableDelimiterLine, (m, lang: string, auto?: string, ro?: string) => {
    return "\n" + delimiterLine(lang.toLowerCase(), !!auto, !!ro);
  });
  if (!startsWithValidDelimiter(s)) {
    s = blockHdrMarkdown + s;
  } else if (!s.includes("\n", 1)) {
    // just a delimiter, without the newline that ends it
    s += "\n";
  }
  return s;
}

// true if s starts with "\n" + valid delimiter line (+ "\n" or end of string)
export function startsWithValidDelimiter(s: string): boolean {
  if (!s.startsWith("\n" + kDelimiterPrefix)) {
    return false;
  }
  let end = s.indexOf("\n", 1);
  let line = end === -1 ? s.slice(1) : s.slice(1, end);
  return parseDelimiterLine(line) !== null;
}
