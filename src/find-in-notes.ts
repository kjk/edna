import { isWholeWord, len } from "./util";

export interface NoteMatch {
  line: string; // the line with the match, as in the original content
  pos: number; // position of the match in content
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
  // toLowerCase() can change length for some characters, in which case positions
  // don't match and we show lower-cased line
  const s = matchCase ? content : content.toLowerCase();
  const display = s.length === content.length ? content : s;

  // must match all other parts on the same line
  function matchesOtherParts(line: string): boolean {
    for (let i = 1; i < len(parts); i++) {
      const part = parts[i]!;
      const idx = line.indexOf(part);
      if (idx < 0) {
        return false;
      }
      if (wholeWord && !isWholeWord(line, idx, idx + len(part))) {
        return false;
      }
    }
    return true;
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
    if (wholeWord && !isWholeWord(s, idx, idx + len(toFind))) {
      continue;
    }
    if (!matchesOtherParts(line)) {
      continue;
    }
    res.push({ line: display.substring(lineStartIdx, lineEndIdx), pos: idx });
  }
  return res;
}
