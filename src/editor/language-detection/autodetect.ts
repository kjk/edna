import { redoDepth } from "@codemirror/commands";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { blockState, getActiveNoteBlock } from "../block/block";
import { changeLanguageTo } from "../block/commands";
import { kLanguages } from "../languages";
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

export function languageDetection(getView: () => EditorView) {
  const previousBlockContent: Record<number, string> = {};
  let idleCallbackId: number | null = null;

  const detectionWorker = new Worker("langdetect-worker.js?worker");
  detectionWorker.onmessage = (event) => {
    //console.log("event:", event.data)
    if (!event.data.guesslang.language) {
      return;
    }
    const view = getView();
    const state = view.state;
    const block = getActiveNoteBlock(state);
    if (!block) return;
    const newLang = GUESSLANG_TO_TOKEN[event.data.guesslang.language];
    if (newLang && block.autoDetect === true && block.language !== newLang) {
      console.log("New auto detected language:", newLang, "Confidence:", event.data.guesslang.confidence);
      let content = state.doc.sliceString(block.content.from, block.content.to);
      const threshold = content.length * 0.1;
      if (levenshtein_distance(content, event.data.content) <= threshold) {
        // the content has not changed significantly so it's safe to change the language
        if (redoDepth(state) === 0) {
          console.log("Changing language to", newLang);
          changeLanguageTo(state, view.dispatch, block, newLang, true);
        } else {
          console.log("Not changing language because the user has undo:ed and has redo history");
        }
      } else {
        console.log("Content has changed significantly, not setting new language");
      }
    }
  };

  const plugin = EditorView.updateListener.of((update) => {
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
          if (b.content.from <= range.from && b.content.to >= range.from) {
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

        const content = update.state.doc.sliceString(block.content.from, block.content.to);
        if (content === "" && redoDepth(update.state) === 0) {
          // if content is cleared, set language to plaintext
          const view = getView();
          const activeBlock = getActiveNoteBlock(view.state);
          if (activeBlock && activeBlock.language !== "text") {
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
          detectionWorker.postMessage({
            content: content,
            idx: idx,
          });
          previousBlockContent[idx] = content;
        }
      });
    }
  });

  return plugin;
}
