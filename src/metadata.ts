// @ts-ignore: tsc can't see exports of .svelte modules (svelte-check does)
import { showError } from "./components/Toaster.svelte";
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
// storage metadata was loaded from (undefined: localStorage)
let metadataStorage: FileSystemDirectoryHandle | undefined | null = null;

export function getNotesMetadata(): NoteMetadata[] {
  metadata!.notes = metadata!.notes || [];
  return metadata!.notes;
}

function getFunctionsMetadata(): FunctionMetadata[] {
  metadata!.functions = metadata!.functions || [];
  return metadata!.functions;
}

// reads metadata file. Returns null if the file doesn't exist.
// Other read errors are re-thrown so that we don't over-write metadata
// with empty data because of a transient error.
export async function readMetadataFileFS(dh: FileSystemDirectoryHandle): Promise<string | null> {
  try {
    return await fsReadTextFile(dh, kMetadataName);
  } catch (e) {
    if (e instanceof DOMException && e.name === "NotFoundError") {
      return null;
    }
    throw e;
  }
}

// parses metadata. On corrupted JSON, saves a backup copy of the raw data
// and returns null
async function parseMetadata(s: string, dh: FileSystemDirectoryHandle | undefined): Promise<unknown> {
  try {
    return JSON.parse(s);
  } catch (e) {
    let backupName = kMetadataName + ".corrupted-" + Date.now();
    console.error(`metadata is not valid JSON, saving a copy as '${backupName}'`, e);
    if (dh) {
      await fsWriteTextFile(dh, backupName, s);
    } else {
      localStorage.setItem(backupName, s);
    }
    return null;
  }
}

export async function loadNotesMetadata(): Promise<Metadata> {
  console.log("loadNotesMetadata: started");
  let dh = getStorageFS();
  let s;
  if (!dh) {
    s = localStorage.getItem(kMetadataName);
  } else {
    s = await readMetadataFileFS(dh);
  }
  let v = s ? await parseMetadata(s, dh) : null;
  // note: "[]" is the old format, upgraded by upgradeMetadata()
  metadata = (v ?? []) as Metadata;
  metadataStorage = dh;
  console.log("loadNotesMetadata: finished", metadata);
  return metadata!;
}

// metadata writes are serialized so that an older snapshot can't be written
// after a newer one
let metadataWriteQueue: Promise<unknown> = Promise.resolve();

export async function saveNotesMetadata(m: Metadata = metadata!) {
  metadata = m;
  let s = JSON.stringify(m, null, 2);
  let dh = getStorageFS();
  let p = metadataWriteQueue.then(async () => {
    if (dh) {
      try {
        await fsWriteTextFile(dh, kMetadataName, s);
      } catch (e) {
        // in-memory metadata is ahead of the file until the next successful
        // save (which writes all metadata); tell the user
        console.error("saveNotesMetadata failed:", e);
        showError(`Failed to save notes metadata (favorites, shortcuts, folds): ${e}`);
      }
    } else {
      localStorage.setItem(kMetadataName, s);
    }
  });
  metadataWriteQueue = p;
  await p;
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
  // an entry left by a note that no longer exists must not win over the
  // renamed note's entry (U7)
  let notes = getNotesMetadata().filter((m) => m.name !== newName || m.name === oldName);
  metadata!.notes = notes;
  for (let o of notes) {
    if (o.name === oldName) {
      o.name = newName;
    }
  }
  await saveNotesMetadata();
}

// called when creating note `name`: removes metadata left by a deleted note
// with that name (e.g. deleted outside of Edna), so the new note doesn't
// inherit its archived / starred state, shortcut, folds (U7).
// No-op if metadata of the current storage isn't loaded (e.g. while booting)
export async function removeStaleNoteMeta(name: string) {
  if (!metadata || metadataStorage !== getStorageFS()) {
    return;
  }
  if (!getNotesMetadata().some((m) => m.name === name)) {
    return;
  }
  console.log(`removeStaleNoteMeta: removing metadata of deleted note '${name}'`);
  await removeNoteFromMetadata(name);
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
      updateAfterNoteStateChange();
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
