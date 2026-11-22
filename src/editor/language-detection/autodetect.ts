import { redoDepth } from "@codemirror/commands";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { blockState, getActiveNoteBlock } from "../block/block";
import { changeLanguageTo } from "../block/commands";
import { kLanguages } from "../languages";
import { SET_CONTENT, transactionsHasAnnotation } from "../annotation";
import { levenshtein_distance } from "./levenshtein";

const GUESSLANG_TO_TOKEN: Record<string, string> = Object.fromEntries(
  kLanguages.filter((l) => l.guesslang).map((l) => [l.guesslang, l.token]),
);

function requestIdleCallbackCompat(cb: IdleRequestCallback): number {
  if (window.requestIdleCallback) {
    return window.requestIdleCallback(cb);
  } else {
    return setTimeout(cb, 0) as unknown as number;
  }
}

function cancelIdleCallbackCompat(id: number): void {
  if (window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

// Applies a detection result to the block it was requested for (by index),
// only if the editor still shows the same document and the block's content
// hasn't changed significantly (issue 15d in docs/state-machines.md)
export function applyDetectionResult(
  view: EditorView,
  result: { guesslang: { language: string; confidence: number }; content: string; idx: number },
): boolean {
  const state = view.state;
  const block = state.field(blockState)[result.idx];
  if (!block) return false;
  const newLang = GUESSLANG_TO_TOKEN[result.guesslang.language];
  if (!newLang || block.autoDetect !== true || block.language === newLang) {
    return false;
  }
  let content = state.doc.sliceString(block.contentFrom, block.to);
  const threshold = content.length * 0.1;
  if (levenshtein_distance(content, result.content) > threshold) {
    // the content has changed significantly
    return false;
  }
  if (redoDepth(state) !== 0) {
    // the user has undo:ed and has redo history
    return false;
  }
  changeLanguageTo(state, view.dispatch, block, newLang, true);
  return true;
}

function createLanguageDetection(view: EditorView) {
  let previousBlockContent: Record<number, string> = {};
  let idleCallbackId: number | null = null;
  // incremented when another document (note) is loaded into the editor;
  // requestDocGen[idx] is docGen when detection for block idx was requested
  let docGen = 0;
  let requestDocGen: Record<number, number> = {};

  const detectionWorker = new Worker("langdetect-worker.js?worker");
  detectionWorker.onmessage = (event) => {
    if (!event.data.guesslang.language) {
      return;
    }
    if (requestDocGen[event.data.idx] !== docGen) {
      // requested for a different note
      return;
    }
    applyDetectionResult(view, event.data);
  };

  const update = (update: ViewUpdate) => {
    if (transactionsHasAnnotation(update.transactions, SET_CONTENT)) {
      // a different note was loaded
      docGen++;
      previousBlockContent = {};
      requestDocGen = {};
    }
    if (update.docChanged) {
      if (idleCallbackId !== null) {
        cancelIdleCallbackCompat(idleCallbackId);
        idleCallbackId = null;
      }

      idleCallbackId = requestIdleCallbackCompat(() => {
        idleCallbackId = null;

        const range = update.state.selection.asSingle().main;
        const blocks = update.state.field(blockState);
        let block: (typeof blocks)[number] | null = null;
        let idx: number | null = null;
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]!;
          if (b.contentFrom <= range.from && b.to >= range.from) {
            block = b;
            idx = i;
            break;
          }
        }
        if (block === null || idx === null) {
          return;
        } else if (block.autoDetect === false) {
          // if language is not auto, set it's previousBlockContent to null so that we'll trigger a language detection
          // immediately if the user changes the language to auto
          delete previousBlockContent[idx];
          return;
        }

        const content = update.state.doc.sliceString(block.contentFrom, block.to);
        if (content === "" && redoDepth(update.state) === 0) {
          // if content is cleared, set language to plaintext.
          // note: the cursor might have moved to another block since the
          // change; only change the block that was cleared
          const activeBlock = getActiveNoteBlock(view.state);
          if (
            activeBlock &&
            activeBlock.from === block.from &&
            activeBlock.autoDetect &&
            activeBlock.contentFrom === activeBlock.to &&
            activeBlock.language !== "text"
          ) {
            changeLanguageTo(view.state, view.dispatch, activeBlock, "text", true);
          }
          delete previousBlockContent[idx];
        }
        if (content.length <= 8) {
          return;
        }
        const threshold = content.length * 0.1;
        const prevContent = previousBlockContent[idx];
        if (!prevContent || levenshtein_distance(prevContent, content) >= threshold) {
          // the content has changed significantly, so schedule a language detection
          //console.log("Scheduling language detection for block", idx, "with threshold", threshold)
          requestDocGen[idx] = docGen;
          detectionWorker.postMessage({
            content: content,
            idx: idx,
          });
          previousBlockContent[idx] = content;
        }
      });
    }
  };

  const destroy = () => {
    if (idleCallbackId !== null) {
      cancelIdleCallbackCompat(idleCallbackId);
      idleCallbackId = null;
    }
    detectionWorker.terminate();
  };

  return { update, destroy };
}

// detects language of auto-detect blocks in a web worker
export const languageDetection = ViewPlugin.define(createLanguageDetection);
