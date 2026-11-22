import { redoDepth } from "@codemirror/commands";
import { MapMode } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { ednaEvent, kLanguageChange, kSetContent, transactionsHasAnnotation } from "../annotation";
import { getActiveNoteBlock, getBlocks } from "../block/block";
import { changeLanguageTo } from "../block/commands";
import { kLanguages } from "../languages";
import { levenshtein_distance } from "./levenshtein";

interface DetectionResult {
  guesslang: { language: string; confidence: number };
  content: string;
}

interface Request {
  from: number;
  content: string;
}

interface DetectionReply {
  idx: number;
  content: string;
  guesslang: DetectionResult["guesslang"] | null;
}

function contentSimilar(a: string, b: string): boolean {
  const tolerance = Math.max(a.length, b.length) / 10;
  return Math.abs(a.length - b.length) <= tolerance && levenshtein_distance(a, b) <= tolerance;
}

export function applyDetectionResult(view: EditorView, result: DetectionResult, blockFrom: number): boolean {
  const { state } = view;
  if (state.readOnly || redoDepth(state)) return false;
  const block = getBlocks(state).find(({ from }) => from === blockFrom);
  if (!block?.autoDetect) return false;
  const language = kLanguages.find(({ guesslang }) => guesslang === result.guesslang.language);
  if (!language || language.token === block.language) return false;
  if (!contentSimilar(state.sliceDoc(block.contentFrom, block.to), result.content)) return false;
  changeLanguageTo(state, view.dispatch, block, language.token, true);
  return true;
}

export const languageDetection = ViewPlugin.define((view) => {
  const worker = typeof Worker === "undefined" ? null : new Worker("/langdetect-worker.js");
  const pending = new Map<number, Request>();
  let seen = new Map<number, string>();
  let changed = new Set<number>();
  let nextRequest = 0;
  let cancel: (() => void) | undefined;
  let disposed = false;

  function detect() {
    cancel = undefined;
    if (disposed) return;
    const targets = changed;
    changed = new Set();
    const reset = [];
    for (const from of targets) {
      const { state } = view;
      if (state.readOnly || redoDepth(state)) return;
      const block = getBlocks(state).find((block) => block.from === from);
      if (!block?.autoDetect) continue;
      const content = state.sliceDoc(block.contentFrom, block.to);
      if (!content.trim()) {
        seen.delete(from);
        for (const [id, request] of pending) if (request.from === from) pending.delete(id);
        if (block.language !== "text") reset.push(from);
        continue;
      }
      const previous = seen.get(from);
      if (!worker || content.length <= 8 || (previous !== undefined && contentSimilar(previous, content))) continue;
      const idx = nextRequest++;
      seen.set(from, content);
      for (const [id, request] of pending) if (request.from === from) pending.delete(id);
      pending.set(idx, { from, content });
      worker.postMessage({ content, idx });
    }
    // Work backwards so changing a header does not move the remaining targets.
    for (const from of reset.sort((a, b) => b - a)) {
      const block = getBlocks(view.state).find((block) => block.from === from);
      if (block) changeLanguageTo(view.state, view.dispatch, block, "text", true);
    }
  }

  function schedule() {
    if (!changed.size || cancel) return;
    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(detect, { timeout: 250 });
      cancel = () => window.cancelIdleCallback(idle);
    } else {
      const timer = window.setTimeout(detect, 50);
      cancel = () => window.clearTimeout(timer);
    }
  }

  if (worker) {
    worker.onmessage = ({ data }: MessageEvent<DetectionReply>) => {
      if (disposed) return;
      const request = pending.get(data.idx);
      if (!request || data.content !== request.content) return;
      pending.delete(data.idx);
      if (data.guesslang)
        applyDetectionResult(view, { guesslang: data.guesslang, content: data.content }, request.from);
    };
  }

  function update(update: ViewUpdate) {
    if (transactionsHasAnnotation(update.transactions, kSetContent)) {
      pending.clear();
      seen.clear();
      changed.clear();
      const active = getActiveNoteBlock(update.state);
      if (active?.autoDetect) changed.add(active.from);
      schedule();
      return;
    }
    if (!update.docChanged) return;

    const blocks = getBlocks(update.state);
    const byStart = new Map(blocks.map((block) => [block.from, block]));
    function mapStart(from: number) {
      const mapped = update.changes.mapPos(from, 1, MapMode.TrackAfter);
      return mapped !== null && byStart.get(mapped)?.autoDetect ? mapped : null;
    }
    for (const [id, request] of pending) {
      const mapped = mapStart(request.from);
      if (mapped === null) pending.delete(id);
      else request.from = mapped;
    }

    const previousSeen = seen;
    seen = new Map();
    for (const [from, content] of previousSeen) {
      const mapped = mapStart(from);
      if (mapped !== null) seen.set(mapped, content);
    }
    changed = new Set([...changed].flatMap((from) => mapStart(from) ?? []));
    const changedLanguage = update.transactions.some((tr) => tr.annotation(ednaEvent) === kLanguageChange);
    if (changedLanguage) {
      const previousAuto = new Set(
        getBlocks(update.startState).flatMap((block) => (block.autoDetect ? (mapStart(block.from) ?? []) : [])),
      );
      for (const block of blocks) {
        if (block.autoDetect && !previousAuto.has(block.from)) changed.add(block.from);
      }
    } else if (!update.transactions.some((tr) => tr.isUserEvent("undo"))) {
      update.changes.iterChangedRanges((_oldFrom, _oldTo, from, to) => {
        for (const block of blocks) {
          if (block.autoDetect && from <= block.to && to >= block.contentFrom) changed.add(block.from);
        }
      });
    }
    schedule();
  }

  function destroy() {
    disposed = true;
    cancel?.();
    pending.clear();
    worker?.terminate();
  }
  return { update, destroy };
});
