export const kDelimiterPrefix = "\u221e\u221e\u221e";

const languageTokenPattern = "[a-z]+";
const languageToken = new RegExp(`^${languageTokenPattern}$`);
const delimiterPattern = new RegExp(`^${kDelimiterPrefix}(${languageTokenPattern})(-a)?(-ro)?$`);

export function isBlockLanguageToken(language: string): boolean {
  return languageToken.test(language);
}

export function delimiterLine(token: string, autoDetect: boolean, readOnly = false): string {
  return kDelimiterPrefix + token + (autoDetect ? "-a" : "") + (readOnly ? "-ro" : "");
}

export function getBlockDelimiter(token: string, autoDetect: boolean, readOnly = false): string {
  return "\n" + delimiterLine(token, autoDetect, readOnly) + "\n";
}

interface BlockHeader {
  language: string;
  autoDetect: boolean;
  readOnly: boolean;
}

export function parseDelimiterLine(line: string): BlockHeader | null {
  const match = delimiterPattern.exec(line);
  if (!match) return null;
  return { language: match[1]!, autoDetect: match[2] !== undefined, readOnly: match[3] !== undefined };
}

export interface NoteBlock {
  index: number;
  from: number;
  to: number;
  contentFrom: number;
  language: string;
  autoDetect: boolean;
  // Omitted for editable blocks to preserve the stored block representation.
  readOnly?: boolean;
}

export interface DelimiterInfo extends BlockHeader {
  start: number;
  end: number;
  langStart: number;
  langEnd: number;
}

// A delimiter owns its preceding newline, when present, and its following newline.
export function findDelimiters(text: string): DelimiterInfo[] {
  const delimiters: DelimiterInfo[] = [];
  function delimiterAt(lineStart: number, start: number): DelimiterInfo | null {
    if (!text.startsWith(kDelimiterPrefix, lineStart)) return null;
    const lineEnd = text.indexOf("\n", lineStart);
    if (lineEnd === -1) return null;
    const header = parseDelimiterLine(text.slice(lineStart, lineEnd));
    if (!header) return null;
    const langStart = lineStart + kDelimiterPrefix.length;
    return { start, end: lineEnd + 1, langStart, langEnd: langStart + header.language.length, ...header };
  }

  let pos = 0;
  if (text.startsWith(kDelimiterPrefix)) {
    const first = delimiterAt(0, 0);
    if (first) delimiters.push(first);
    pos = first?.end ?? text.indexOf("\n") + 1;
  }
  while (pos < text.length) {
    const newline = text.indexOf("\n", pos);
    if (newline === -1) break;
    const delimiter = delimiterAt(newline + 1, newline);
    if (delimiter) delimiters.push(delimiter);
    pos = delimiter?.end ?? newline + 1;
  }
  return delimiters;
}

export function getBlocksFromString(text: string): NoteBlock[] {
  const delimiters = findDelimiters(text);
  return delimiters.map(({ start, end, language, autoDetect, readOnly }, index) => ({
    index,
    from: start,
    to: delimiters[index + 1]?.start ?? text.length,
    contentFrom: end,
    language,
    autoDetect,
    ...(readOnly ? { readOnly: true } : {}),
  }));
}
