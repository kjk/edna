// @ts-ignore: tsc can't see exports of .svelte modules (svelte-check does)
import { showError } from "./components/Toaster.svelte";
import { fsReadTextFile, fsWriteFile } from "./fileutil";
import { updateAfterNoteStateChange } from "./globals";
import { normalizeMetadata } from "./metadata-merge";
import { getStorageFS } from "./notes";
import { SerialQueue, tryParseJSON } from "./util";

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

// metadata.notes or metadata.functions, created if missing
function metadataList<K extends "notes" | "functions">(key: K): NonNullable<Metadata[K]> {
  metadata![key] = metadata![key] || ([] as any);
  return metadata![key]!;
}

export function getNotesMetadata(): NoteMetadata[] {
  return metadataList("notes");
}

function getFunctionsMetadata(): FunctionMetadata[] {
  return metadataList("functions");
}

// item named name in list; if not found, adds one if createIfNotExists
function findOrCreateByName<T extends { name: string }>(list: T[], name: string, createIfNotExists: boolean): T | null {
  let m = list.find((m) => m.name === name);
  if (m || !createIfNotExists) {
    return m ?? null;
  }
  m = { name } as T;
  list.push(m);
  return m;
}

// writes s as file name in directory dh, or as localStorage item if no dh
async function writeStorageText(dh: FileSystemDirectoryHandle | undefined, name: string, s: string) {
  if (dh) {
    await fsWriteFile(dh, name, s);
  } else {
    localStorage.setItem(name, s);
  }
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
  let backup: Promise<void> | undefined;
  let v = tryParseJSON(s, "metadata", () => {
    let backupName = kMetadataName + ".corrupted-" + Date.now();
    console.error(`saving a copy of corrupted metadata as '${backupName}'`);
    backup = writeStorageText(dh, backupName, s);
  });
  await backup;
  return v ?? null;
}

// metadata stored in directory dh (localStorage if undefined), parsed but not
// normalized; null if there is none or it's corrupted (a copy is saved)
export async function readStoredMetadata(dh: FileSystemDirectoryHandle | undefined): Promise<unknown> {
  let s = dh ? await readMetadataFileFS(dh) : localStorage.getItem(kMetadataName);
  return s ? await parseMetadata(s, dh) : null;
}

export async function loadNotesMetadata(): Promise<Metadata> {
  console.log("loadNotesMetadata: started");
  let dh = getStorageFS();
  let v = await readStoredMetadata(dh);
  // note: "[]" is the old format, upgraded by upgradeMetadata()
  metadata = v == null || Array.isArray(v) ? ((v ?? []) as any) : normalizeMetadata(v);
  metadataStorage = dh;
  console.log("loadNotesMetadata: finished", metadata);
  return metadata!;
}

// metadata writes are serialized so that an older snapshot can't be written
// after a newer one
const metadataWriteQueue = new SerialQueue();

export async function saveNotesMetadata(m: Metadata = metadata!) {
  metadata = m;
  let s = JSON.stringify(m, null, 2);
  let dh = getStorageFS();
  await metadataWriteQueue.run(async () => {
    try {
      await writeStorageText(dh, kMetadataName, s);
    } catch (e) {
      // in-memory metadata is ahead of the file until the next successful
      // save (which writes all metadata); tell the user
      console.error("saveNotesMetadata failed:", e);
      showError(`Failed to save notes metadata (favorites, shortcuts, folds): ${e}`);
    }
  });
  return m;
}

export function getNoteMeta(name: string, createIfNotExists = false): NoteMetadata | null {
  return findOrCreateByName(getNotesMetadata(), name, createIfNotExists);
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
  if (!getNoteMeta(name)) {
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
      await updateNoteMeta(name, (m) => delete m.altShortcut);
      return;
    } else {
      // a different note: remove shortcut and then assign to the new note
      delete o.altShortcut;
    }
  }

  await updateNoteMeta(name, (m) => (m.altShortcut = altShortcut));
}

// changes metadata entry m with change() and saves it; notifyUI: m is about
// a note, so note lists etc. need to be updated
async function changeMeta<M, T>(m: M, change: (m: M) => T, notifyUI: boolean): Promise<T> {
  let res = change(m);
  await saveNotesMetadata();
  if (notifyUI) {
    updateAfterNoteStateChange();
  }
  return res;
}

// changes metadata of note name with change(), saves it and updates the UI
async function updateNoteMeta<T>(name: string, change: (m: NoteMetadata) => T): Promise<T> {
  return changeMeta(getNoteMeta(name, true)!, change, true);
}

export async function setNoteArchived(name: string, isArchived: boolean) {
  await updateNoteMeta(name, (m) => (m.isArchived = isArchived));
}

export async function archiveNote(name: string) {
  await setNoteArchived(name, true);
}

export async function unArchiveNote(name: string) {
  await setNoteArchived(name, false);
}

// flips isStarred of note or function metadata; returns the new value
function flipStarred(m: { isStarred?: boolean }): boolean {
  m.isStarred = !m.isStarred;
  return m.isStarred;
}

export async function toggleNoteStarred(name: string): Promise<boolean> {
  return updateNoteMeta(name, flipStarred);
}

export function isNoteArchived(name: string): boolean {
  let meta = getNoteMeta(name);
  if (!meta) {
    return false;
  }
  return meta.isArchived === true;
}

export function getFunctionMeta(name: string, createIfNotExists = false): FunctionMetadata | null {
  return findOrCreateByName(getFunctionsMetadata(), name, createIfNotExists);
}

export async function toggleFunctionStarred(name: string): Promise<boolean> {
  return changeMeta(getFunctionMeta(name, true)!, flipStarred, false);
}

// TODO: temporary
export async function upgradeMetadata() {
  let meta = await loadNotesMetadata();
  if (!Array.isArray(meta)) {
    console.log("upgradeMetadata: already upgraded:", meta);
    return;
  }
  let newMeta = normalizeMetadata(meta);
  console.log("upgradeMetadata: new meta:", newMeta);
  await saveNotesMetadata(newMeta);
}
