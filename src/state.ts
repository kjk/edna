/** @typedef {{
  appOpenCount: number,
  noteCreateCount: number,
  noteDeleteCount: number,
  noteSaveCount: number,
}} Stats
*/

import { logNoteOp } from "./log";

let sessionStart = performance.now();

export function getSessionDurationInMs() {
  return Math.round(performance.now() - sessionStart);
}

const kStatsKey = "stats.json";

// TODO: optimize by keeping in-mem copy of kStatsKey
// so that getCount() can get it from there and incCount()
// doesn't have to read from localStorage and parse JSON

/**
 * @returns {Stats}
 */
export function getStats() {
  let s = localStorage.getItem(kStatsKey) || "{}";
  /** @type {Stats} */
  let stats = JSON.parse(s);
  stats.appOpenCount = stats.appOpenCount || 0;
  stats.noteCreateCount = stats.noteCreateCount || 0;
  stats.noteDeleteCount = stats.noteDeleteCount || 0;
  stats.noteSaveCount = stats.noteSaveCount || 0;
  return stats;
}

/**
 * @param {(Stats) => void} fn
 */
export function updateStats(fn) {
  let stats = getStats();
  fn(stats);
  let s = JSON.stringify(stats, null, 2);
  localStorage.setItem(kStatsKey, s);
}

/**
 * TODO: a way to type key as one of the keys of Stats?
 * @param {string} key
 * @returns {number}
 * */
function incCount(key) {
  let n;
  updateStats((stats) => {
    n = (stats[key] || 0) + 1;
    stats[key] = n;
  });
  return n;
}

/**
 * @returns {number}
 */
export function incNoteCreateCount() {
  return incCount("noteCreateCount");
}

/**
 * @returns {number}
 */
export function incNoteDeleteCount() {
  return incCount("noteDeleteCount");
}

/**
 * @returns {number}
 */
export function incNoteSaveCount() {
  logNoteOp("noteSave");
  return incCount("noteSaveCount");
}

let stats = getStats();
console.log(
  "appOpenCount:",
  stats.appOpenCount,
  "noteCreateCount:",
  stats.noteCreateCount,
  "noteSaveCount",
  stats.noteSaveCount,
);

incCount("appOpenCount");

let editors = [];

export function rememberEditor(editor) {
  editors = []; // TODO: for now we only have one editor
  editors.push(editor);
  // TODO: this is for tests
  // @ts-ignore
  window.ednaCurrentEditor = editor;
}

export function findEditorByView(view) {
  for (let e of editors) {
    if (e.view === view) {
      return e;
    }
  }
  return null;
}
