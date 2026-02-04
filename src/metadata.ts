import { tick } from "svelte";
import { fsReadTextFile, fsWriteTextFile } from "./fileutil";
import { updateAfterNoteStateChange } from "./globals";
import { getStorageFS } from "./notes";

export const kMetadataName = "__metadata.edna.json";

export interface NoteMetadata {
  name: string;
  altShortcut?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  foldedRanges?: { from: number; to: number }[];
  selection?: any;
}

export interface FunctionMetadata {
  name: string;
  isStarred?: boolean;
}

export interface Metadata {
  ver: number;
  notes: NoteMetadata[];
  functions: FunctionMetadata[];
}

let metadata: Metadata | null = null;

export function getMetadata(): Metadata | null {
  return metadata;
}

export function getNotesMetadata(): NoteMetadata[] {
  metadata!.notes = metadata!.notes || [];
  return metadata!.notes;
}

function getFunctionsMetadata(): FunctionMetadata[] {
  metadata!.functions = metadata!.functions || [];
  return metadata!.functions;
}

export async function loadNotesMetadata(): Promise<Metadata> {
  console.log("loadNotesMetadata: started");
  let dh = getStorageFS();
  let s;
  if (!dh) {
    s = localStorage.getItem(kMetadataName);
  } else {
    try {
      s = await fsReadTextFile(dh, kMetadataName);
    } catch (e) {
      // it's ok if doesn't exist
      console.log("loadNotesMetadata: no metadata file", e);
      s = "[]";
    }
  }
  s = s || "[]";
  metadata = JSON.parse(s);
  console.log("loadNotesMetadata: finished", metadata);
  return metadata!;
}

export async function saveNotesMetadata(m: Metadata = metadata!) {
  let s = JSON.stringify(m, null, 2);
  let dh = getStorageFS();
  if (dh) {
    try {
      await fsWriteTextFile(dh, kMetadataName, s);
    } catch (e) {
      console.log("fsWriteTextFile failed with:", e);
    }
  } else {
    localStorage.setItem(kMetadataName, s);
  }
  metadata = m;
  return m;
}

export function getNoteMeta(name: string, createIfNotExists = false): NoteMetadata | null {
  // console.log("getNoteMeta:", name);
  let notes = getNotesMetadata();
  for (let m of notes) {
    if (m.name === name) {
      return m;
    }
  }
  if (!createIfNotExists) {
    return null;
  }
  let m = {
    name: name,
  };
  notes.push(m);
  return m;
}

export async function removeNoteFromMetadata(name: string) {
  let notes = getNotesMetadata();
  let newNotes = [];
  for (let m of notes) {
    if (m.name !== name) {
      newNotes.push(m);
    }
  }
  metadata!.notes = newNotes;
  await saveNotesMetadata();
}

export async function renameNoteInMetadata(oldName: string, newName: string) {
  let notes = getNotesMetadata();
  for (let o of notes) {
    if (o.name === oldName) {
      o.name = newName;
      break;
    }
  }
  await saveNotesMetadata();
}

export async function reassignNoteShortcut(name: string, altShortcut: string) {
  console.log("reassignNoteShortcut:", name, altShortcut);
  let notes = getNotesMetadata();
  for (let o of notes) {
    if (o.altShortcut !== altShortcut) {
      continue;
    }
    if (o.name === name) {
      // same note: just remove shortcut
      delete o.altShortcut;
      let res = await saveNotesMetadata();
      return res;
    } else {
      // a different note: remove shortcut and then assign to the new note
      delete o.altShortcut;
    }
  }

  let meta = getNoteMeta(name, true)!;
  meta.altShortcut = altShortcut;
  await saveNotesMetadata();
  updateAfterNoteStateChange();
}

export async function archiveNote(name: string) {
  let m = getNoteMeta(name, true)!;
  m.isArchived = true;
  await saveNotesMetadata();
  updateAfterNoteStateChange();
}

export async function unArchiveNote(name: string) {
  let m = getNoteMeta(name, true)!;
  m.isArchived = false;
  await saveNotesMetadata();
  updateAfterNoteStateChange();
}

export async function toggleNoteStarred(name: string): Promise<boolean> {
  let meta = getNoteMeta(name, true)!;
  meta.isStarred = !meta.isStarred;
  await saveNotesMetadata();
  updateAfterNoteStateChange();
  return !!meta.isStarred;
}

export function isNoteArchived(name: string): boolean {
  let meta = getNoteMeta(name);
  if (!meta) {
    return false;
  }
  return meta.isArchived === true;
}

export function getFunctionMeta(name: string, createIfNotExists = false): FunctionMetadata | null {
  // console.log("getMetadataForFunction:", name);
  let functions = getFunctionsMetadata();
  for (let m of functions) {
    if (m.name === name) {
      return m;
    }
  }
  if (!createIfNotExists) {
    return null;
  }
  let m = {
    name: name,
  };
  functions.push(m);
  return m;
}

export async function toggleFunctionStarred(name: string): Promise<boolean> {
  let m = getFunctionMeta(name, true)!;
  m.isStarred = !m.isStarred;
  await saveNotesMetadata();
  return !!m.isStarred;
}

export function printMetaInfo() {
  let notes = getNotesMetadata();
  console.log("Notes metadata:");
  for (let m of notes) {
    if (m.isArchived) {
      console.log(`  ${m.name} isArchived: ${m.isArchived}`);
    }
  }
}

// TODO: temporary
export async function upgradeMetadata() {
  let meta = await loadNotesMetadata();
  if (!Array.isArray(meta)) {
    console.log("upgradeMetadata: already upgraded:", meta);
    return;
  }
  let newMeta = {
    ver: 1,
    notes: meta,
    functions: [],
  };
  console.log("upgradeMetadata: new meta:", newMeta);
  await saveNotesMetadata(newMeta);
}
