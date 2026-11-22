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
export function mergeMetadata(primary: Metadata, secondary: Metadata): Metadata {
  let notes = [...primary.notes];
  for (let n of secondary.notes) {
    if (notes.some((o) => o.name === n.name)) {
      continue;
    }
    if (n.altShortcut && notes.some((o) => o.altShortcut === n.altShortcut)) {
      // shortcut already assigned to a different note
      n = { ...n };
      delete n.altShortcut;
    }
    notes.push(n);
  }
  let functions = [...primary.functions];
  for (let f of secondary.functions) {
    if (!functions.some((o) => o.name === f.name)) {
      functions.push(f);
    }
  }
  return { ...primary, notes, functions };
}
