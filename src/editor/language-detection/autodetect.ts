import { redoDepth } from "@codemirror/commands";
import { MapMode } from "@codemirror/state";
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

// Applies a detection result to the block it was requested for: the block that
// starts at blockFrom (its start position mapped through edits made since the
// request, so inserting or deleting blocks before it doesn't matter, U28), only
// if the block's content hasn't changed significantly (issue 15d)
export function applyDetectionResult(
  view: EditorView,
  result: { guesslang: { language: string; confidence: number }; content: string },
  blockFrom: number,
): boolean {
  const state = view.state;
  const block = state.field(blockState).find((b) => b.from === blockFrom);
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
  // detection requests in flight: request id => start of the block it's for,
  // kept up to date with edits. Cleared when another note is loaded
  let pending = new Map<number, number>();
  let nextRequestID = 1;

  const detectionWorker = new Worker("langdetect-worker.js?worker");
  detectionWorker.onmessage = (event) => {
    // the worker echoes back the idx we sent: the request id
    const blockFrom = pending.get(event.data.idx);
    pending.delete(event.data.idx);
    if (blockFrom === undefined || !event.data.guesslang.language) {
      // e.g. requested for a different note, or the block was deleted
      return;
    }
    applyDetectionResult(view, event.data, blockFrom);
  };

  const update = (update: ViewUpdate) => {
    if (transactionsHasAnnotation(update.transactions, SET_CONTENT)) {
      // a different note was loaded
      previousBlockContent = {};
      pending.clear();
    } else if (update.docChanged && pending.size > 0) {
      for (let [id, from] of pending) {
        // null if the block's start was deleted
        const mapped = update.changes.mapPos(from, 1, MapMode.TrackDel);
        if (mapped === null) {
          pending.delete(id);
        } else {
          pending.set(id, mapped);
        }
      }
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
          // the state might be older than view.state: map the block start
          // through changes made since (idle callback)
          let from = block.from;
          if (update.state.doc !== view.state.doc) {
            // can't map reliably: request again on the next change
            return;
          }
          const id = nextRequestID++;
          pending.set(id, from);
          detectionWorker.postMessage({
            content: content,
            idx: id,
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
