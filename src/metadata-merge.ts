import type { Metadata } from "./metadata";

// converts old format (array of notes) and fills in missing fields
export function normalizeMetadata(v: unknown): Metadata {
  if (Array.isArray(v)) {
    return { ver: 1, notes: v, functions: [] };
  }
  let m = (v && typeof v === "object" ? v : {}) as Partial<Metadata>;
  // entries must be objects with a name (U8): metadata is user-editable
  let entries = (a: unknown): any[] =>
    Array.isArray(a) ? a.filter((e) => e && typeof e === "object" && typeof e.name === "string") : [];
  return {
    ...m,
    ver: m.ver ?? 1,
    notes: entries(m.notes),
    functions: entries(m.functions),
  };
}

// merge metadata: for notes / functions present in both, entries in primary win
// primary plus entries of secondary whose name isn't in primary (adjusted by adjust())
function mergeByName<T extends { name: string }>(primary: T[], secondary: T[], adjust = (e: T, merged: T[]) => e): T[] {
  let merged = [...primary];
  for (let e of secondary) {
    if (!merged.some((o) => o.name === e.name)) {
      merged.push(adjust(e, merged));
    }
  }
  return merged;
}

// merge metadata: for notes / functions present in both, entries in primary win
export function mergeMetadata(primary: Metadata, secondary: Metadata): Metadata {
  let notes = mergeByName(primary.notes, secondary.notes, (n, merged) => {
    if (n.altShortcut && merged.some((o) => o.altShortcut === n.altShortcut)) {
      // shortcut already assigned to a different note
      n = { ...n };
      delete n.altShortcut;
    }
    return n;
  });
  let functions = mergeByName(primary.functions, secondary.functions);
  return { ...primary, notes, functions };
}
