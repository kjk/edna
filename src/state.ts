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

// in-memory copy so that we don't have to read and parse JSON on every update
let statsCached: Stats | undefined;

export function getStats(): Stats {
  if (!statsCached) {
    let s = localStorage.getItem(kStatsKey) || "{}";
    let stats: Stats = {} as Stats;
    try {
      let v = JSON.parse(s);
      if (v && typeof v === "object") {
        stats = v;
      }
    } catch (e) {
      // runs at module load: corrupt stats must not stop the app (U8)
      console.error("getStats: stats are not valid JSON", e);
    }
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

// notes are auto-saved every few seconds while typing. Total save count is
// sent with appOpen / appExit stats so we don't need to log every save
const kLogNoteSaveIntervalMs = 10 * 60 * 1000;
let lastNoteSaveLogTime = 0;

export function incNoteSaveCount(): number {
  let now = Date.now();
  if (now - lastNoteSaveLogTime > kLogNoteSaveIntervalMs) {
    lastNoteSaveLogTime = now;
    logNoteOp("noteSave");
  }
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
