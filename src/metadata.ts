// @ts-ignore: tsc can't see exports of .svelte modules (svelte-check does)
import { showError } from "./components/Toaster.svelte";
import { fsReadTextFile, fsWriteFile } from "./fileutil";
import { normalizeMetadata } from "./metadata-merge";
import { metadataState } from "./metadata-state.svelte";
import { kDailyJournalNoteName } from "./constants";
import { getStorageFS } from "./note-storage";
import { SerialQueue, tryParseJSON } from "./util";

export const kMetadataName = "__metadata.edna.json";

export interface NoteMetadata {
  name: string;
  altShortcut?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  foldedRanges?: { from: number; to: number }[];
  selection?: any;
  // add "# YYYY-MM-DD Day" block for today when the note is opened.
  // If not set: true only for the daily journal note (#25)
  dailyEntry?: boolean;
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

// storage metadata was loaded from (undefined: localStorage)
let metadataStorage: FileSystemDirectoryHandle | undefined | null = null;

export function getNotesMetadata(): NoteMetadata[] {
  return metadataState.current.notes;
}

export function serializeNotesMetadata(): string {
  return serializeMetadata(metadataState.current);
}

// item named name in list; if not found, adds one if createIfNotExists
function findOrCreateByName<T extends { name: string }>(list: T[], name: string, createIfNotExists: boolean): T | null {
  let m = list.find((m) => m.name === name);
  if (m || !createIfNotExists) {
    return m ?? null;
  }
  list.push({ name } as T);
  return list[list.length - 1]!;
}

// writes s as file name in directory dh, or as localStorage item if no dh
async function writeStorageText(dh: FileSystemDirectoryHandle | undefined, name: string, s: string) {
  if (dh) {
    await fsWriteFile(dh, name, s);
  } else {
    localStorage.setItem(name, s);
  }
}

// serialize before queueing to capture the metadata at the call site
const metadataWriteQueue = new SerialQueue();

// writes m as the metadata file of dh (localStorage if undefined)
export async function writeMetadataFile(dh: FileSystemDirectoryHandle | undefined, m: Metadata) {
  let snapshot = serializeMetadata(m);
  await metadataWriteQueue.run(() => writeStorageText(dh, kMetadataName, snapshot));
}

function serializeMetadata(m: Metadata): string {
  return JSON.stringify(m, null, 2);
}

// reads metadata file. Returns null if the file doesn't exist.
// Other read errors are re-thrown so that we don't over-write metadata
// with empty data because of a transient error.
async function readMetadataFileFS(dh: FileSystemDirectoryHandle): Promise<string | null> {
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
async function readMetadataData(dh: FileSystemDirectoryHandle | undefined): Promise<unknown> {
  let s = dh ? await readMetadataFileFS(dh) : localStorage.getItem(kMetadataName);
  return s ? await parseMetadata(s, dh) : null;
}

export async function readStoredMetadata(dh: FileSystemDirectoryHandle | undefined): Promise<Metadata> {
  return normalizeMetadata(await readMetadataData(dh));
}

export async function loadNotesMetadata() {
  let dh = getStorageFS();
  let stored = await readMetadataData(dh);
  let loaded = normalizeMetadata(stored);
  metadataState.current = loaded;
  metadataStorage = dh;
  if (stored == null || Array.isArray(stored)) {
    await persistNotesMetadata(dh, loaded);
  }
}

export function saveNotesMetadata(m?: Metadata): Promise<void> {
  if (m) {
    metadataState.current = m;
    metadataStorage = getStorageFS();
  }
  let dh = metadataStorage === null ? getStorageFS() : metadataStorage;
  return persistNotesMetadata(dh, metadataState.current);
}

async function persistNotesMetadata(dh: FileSystemDirectoryHandle | undefined, m: Metadata): Promise<void> {
  try {
    await writeMetadataFile(dh, m);
  } catch (e) {
    // in-memory metadata is ahead of the file until the next successful
    // save (which writes all metadata); tell the user
    console.error("saveNotesMetadata failed:", e);
    showError(`Failed to save notes metadata (favorites, shortcuts, folds): ${e}`);
  }
}

export function getNoteMeta(name: string, createIfNotExists = false): NoteMetadata | null {
  return findOrCreateByName(getNotesMetadata(), name, createIfNotExists);
}

export async function removeNoteFromMetadata(name: string) {
  metadataState.current.notes = getNotesMetadata().filter((m) => m.name !== name);
  await saveNotesMetadata();
}

export async function renameNoteInMetadata(oldName: string, newName: string) {
  // an entry left by a note that no longer exists must not win over the
  // renamed note's entry (U7)
  let notes = getNotesMetadata().filter((m) => m.name !== newName || m.name === oldName);
  for (let o of notes) {
    if (o.name === oldName) {
      // daily journal keeps adding daily entries after a rename (#25)
      o.dailyEntry = o.dailyEntry ?? (oldName === kDailyJournalNoteName || undefined);
      o.name = newName;
    }
  }
  if (oldName === kDailyJournalNoteName && !notes.some((o) => o.name === newName)) {
    notes.push({ name: newName, dailyEntry: true });
  }
  metadataState.current.notes = notes;
  await saveNotesMetadata();
}

// called when creating note `name`: removes metadata left by a deleted note
// with that name (e.g. deleted outside of Edna), so the new note doesn't
// inherit its archived / starred state, shortcut, folds (U7).
// No-op if metadata of the current storage isn't loaded (e.g. while booting)
export async function removeStaleNoteMeta(name: string) {
  if (metadataStorage !== getStorageFS()) {
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

async function changeMeta<M, T>(m: M, change: (m: M) => T): Promise<T> {
  let res = change(m);
  await saveNotesMetadata();
  return res;
}

async function updateNoteMeta<T>(name: string, change: (m: NoteMetadata) => T): Promise<T> {
  return changeMeta(getNoteMeta(name, true)!, change);
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

// true if a block for today is added to note name when it's opened (#25)
export function noteHasDailyEntry(name: string): boolean {
  return getNoteMeta(name)?.dailyEntry ?? name === kDailyJournalNoteName;
}

export async function setNoteDailyEntry(name: string, dailyEntry: boolean) {
  await updateNoteMeta(name, (m) => (m.dailyEntry = dailyEntry));
}

export function isNoteArchived(name: string): boolean {
  let meta = getNoteMeta(name);
  if (!meta) {
    return false;
  }
  return meta.isArchived === true;
}

export function getFunctionMeta(name: string, createIfNotExists = false): FunctionMetadata | null {
  return findOrCreateByName(metadataState.current.functions, name, createIfNotExists);
}

export async function toggleFunctionStarred(name: string): Promise<boolean> {
  return changeMeta(getFunctionMeta(name, true)!, flipStarred);
}
