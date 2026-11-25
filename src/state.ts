import { startTimer, tryParseJSONObject } from "./util";

export interface Stats {
  appOpenCount: number;
  noteCreateCount: number;
  noteDeleteCount: number;
  noteSaveCount: number;
}

export const getSessionDurationInMs = startTimer();

const kStatsKey = "stats.json";

// in-memory copy so that we don't have to read and parse JSON on every update
let statsCached: Stats | undefined;

export function getStats(): Stats {
  if (!statsCached) {
    let s = localStorage.getItem(kStatsKey) || "{}";
    // runs at module load: corrupt stats must not stop the app (U8)
    let stats = tryParseJSONObject(s, "stats") as Stats;
    stats.appOpenCount = stats.appOpenCount || 0;
    stats.noteCreateCount = stats.noteCreateCount || 0;
    stats.noteDeleteCount = stats.noteDeleteCount || 0;
    stats.noteSaveCount = stats.noteSaveCount || 0;
    statsCached = stats;
  }
  return { ...statsCached };
}

export function updateStats(fn: (stats: Stats) => void) {
  let stats = getStats();
  fn(stats);
  statsCached = stats;
  localStorage.setItem(kStatsKey, JSON.stringify(stats, null, 2));
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
