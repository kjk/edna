import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { IterMode } from "@lezer/common";
import { Document, Note, NoteDelimiter } from "../lang-heynote/parser.terms";
import type { SimpleRange } from "../types";

export interface NoteBlock {
  language: { name: string; auto: boolean };
  content: SimpleRange;
  delimiter: SimpleRange;
  range: SimpleRange;
}

// tracks the size of the first delimiter
export let firstBlockDelimiterSize: number | undefined;

function startTimer() {
  const timeStart = performance.now();
  return function () {
    return Math.round(performance.now() - timeStart);
  };
}

/**
 * Return a list of blocks in the document from the syntax tree.
 * syntaxTreeAvailable() should have been called before this function to ensure the syntax tree is available.
 */
export function getBlocksFromSyntaxTree(state: EditorState): NoteBlock[] {
  //const timer = startTimer()
  const blocks: NoteBlock[] = [];
  const tree = syntaxTree(state);
  if (tree) {
    tree.iterate({
      enter: (type) => {
        if (type.type.id == Document || type.type.id == Note) {
          return true;
        } else if (type.type.id === NoteDelimiter) {
          const langNode = type.node.getChild("NoteLanguage");
          if (!langNode) return false;
          const language = state.doc.sliceString(langNode.from, langNode.to);
          const isAuto = !!type.node.getChild("Auto");
          const contentNode = type.node.nextSibling;
          if (!contentNode) return false;
          blocks.push({
            language: {
              name: language,
              auto: isAuto,
            },
            content: {
              from: contentNode.from,
              to: contentNode.to,
            },
            delimiter: {
              from: type.from,
              to: type.to,
            },
            range: {
              from: type.node.from,
              to: contentNode.to,
            },
          });
          return false;
        }
        return false;
      },
      mode: IterMode.IgnoreMounts,
    });
    firstBlockDelimiterSize = blocks[0]?.delimiter.to;
  }
  //console.log("getBlocksSyntaxTree took", timer(), "ms")
  return blocks;
}

/**
 * Parse blocks from document's string contents using String.indexOf()
 */
export function getBlocksFromString(state: EditorState): NoteBlock[] {
  //const timer = startTimer()
  const blocks: NoteBlock[] = [];
  const doc = state.doc;
  if (doc.length === 0) {
    return [];
  }
  const content = doc.sliceString(0, doc.length);
  const delim = "\n∞∞∞";
  let pos = 0;
  while (pos < doc.length) {
    const blockStart = content.indexOf(delim, pos);
    if (blockStart != pos) {
      console.error("Error parsing blocks, expected delimiter at", pos);
      break;
    }
    const langStart = blockStart + delim.length;
    const delimiterEnd = content.indexOf("\n", langStart);
    if (delimiterEnd < 0) {
      console.error("Error parsing blocks. Delimiter didn't end with newline");
      break;
    }
    const langFull = content.substring(langStart, delimiterEnd);
    let auto = false;
    let lang = langFull;
    if (langFull.endsWith("-a")) {
      auto = true;
      lang = langFull.substring(0, langFull.length - 2);
    }
    const contentFrom = delimiterEnd + 1;
    let blockEnd = content.indexOf(delim, contentFrom);
    if (blockEnd < 0) {
      blockEnd = doc.length;
    }

    const block = {
      language: {
        name: lang,
        auto: auto,
      },
      content: {
        from: contentFrom,
        to: blockEnd,
      },
      delimiter: {
        from: blockStart,
        to: delimiterEnd + 1,
      },
      range: {
        from: blockStart,
        to: blockEnd,
      },
    };
    blocks.push(block);
    pos = blockEnd;
  }
  //console.log("getBlocksFromString() took", timer(), "ms")
  return blocks;
}
