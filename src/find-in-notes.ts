import { parseDelimiterLine } from "./editor/new-parser/node-types";
import { isWholeWord, len, stringMatchesParts } from "./util";

export interface NoteMatch {
  line: string; // the line with the match, as in the original content
  pos: number; // position of the match in content
}

// lower-cases content character by character. map[i] is the position in
// content of position i in the result (and map[result.length] = content.length)
function toLowerCaseWithMap(content: string): { s: string; map: number[] } {
  let parts: string[] = [];
  let map: number[] = [];
  for (let i = 0; i < content.length; ) {
    let ch = String.fromCodePoint(content.codePointAt(i)!);
    let lc = ch.toLowerCase();
    for (let k = 0; k < lc.length; k++) {
      map.push(i);
    }
    parts.push(lc);
    i += ch.length;
  }
  map.push(content.length);
  return { s: parts.join(""), map };
}

/**
 * Find lines in note content that match all search parts.
 * The first part is searched in the whole content, other parts must be on the
 * same line. When matchCase is false, parts must be lower-cased.
 */
export function findMatchesInNote(
  content: string,
  parts: string[],
  matchCase: boolean,
  wholeWord: boolean,
  maxResults = Infinity,
): NoteMatch[] {
  const res: NoteMatch[] = [];
  const toFind = parts[0];
  if (!toFind) {
    return res;
  }
  // when not matching case we search in lower-cased text but show original text.
  // toLowerCase() can change length for some characters (e.g. "İ"): then
  // positions are mapped back to content (U23)
  let s = matchCase ? content : content.toLowerCase();
  let map: number[] | undefined;
  if (s.length !== content.length) {
    ({ s, map } = toLowerCaseWithMap(content));
  }
  const toContentPos = (i: number) => (map ? map[i]! : i);

  // must match all other parts on the same line
  function matchesOtherParts(line: string): boolean {
    return stringMatchesParts(line, parts.slice(1), (idx, part) => !wholeWord || isWholeWord(line, idx, idx + len(part)));
  }

  let startIdx = 0;
  while (len(res) < maxResults) {
    const idx = s.indexOf(toFind, startIdx);
    if (idx < 0) {
      break;
    }
    startIdx = idx + 1;

    const lineStartIdx = s.lastIndexOf("\n", idx - 1) + 1;
    let lineEndIdx = s.indexOf("\n", idx + 1);
    if (lineEndIdx < 0) {
      lineEndIdx = s.length;
    }
    const line = s.substring(lineStartIdx, lineEndIdx);
    // block delimiter lines (e.g. ∞∞∞markdown) are not content
    const contentLine = content.substring(toContentPos(lineStartIdx), toContentPos(lineEndIdx));
    if (parseDelimiterLine(contentLine)) {
      startIdx = lineEndIdx;
      continue;
    }
    if (wholeWord && !isWholeWord(s, idx, idx + len(toFind))) {
      continue;
    }
    // the rest is per-line: report each line once and skip other matches on it
    startIdx = lineEndIdx;
    if (!matchesOtherParts(line)) {
      continue;
    }
    res.push({ line: contentLine, pos: toContentPos(idx) });
  }
  return res;
}
