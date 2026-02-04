import { logNoteOp } from "./log";

export interface Stats {
  appOpenCount: number;
  noteCreateCount: number;
  noteDeleteCount: number;
  noteSaveCount: number;
}

let sessionStart = performance.now();

export function getSessionDurationInMs() {
  return Math.round(performance.now() - sessionStart);
}

const kStatsKey = "stats.json";

// TODO: optimize by keeping in-mem copy of kStatsKey
// so that getCount() can get it from there and incCount()
// doesn't have to read from localStorage and parse JSON

export function getStats(): Stats {
  let s = localStorage.getItem(kStatsKey) || "{}";
  let stats: Stats = JSON.parse(s);
  stats.appOpenCount = stats.appOpenCount || 0;
  stats.noteCreateCount = stats.noteCreateCount || 0;
  stats.noteDeleteCount = stats.noteDeleteCount || 0;
  stats.noteSaveCount = stats.noteSaveCount || 0;
  return stats;
}

export function updateStats(fn: (stats: Stats) => void) {
  let stats = getStats();
  fn(stats);
  let s = JSON.stringify(stats, null, 2);
  localStorage.setItem(kStatsKey, s);
}

function incCount(key: keyof Stats): number {
  let n = 0;
  updateStats((stats) => {
    n = (stats[key] || 0) + 1;
    stats[key] = n;
  });
  return n;
}

export function incNoteCreateCount(): number {
  return incCount("noteCreateCount");
}

export function incNoteDeleteCount(): number {
  return incCount("noteDeleteCount");
}

export function incNoteSaveCount(): number {
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
