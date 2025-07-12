import { findNoteByName, getNotes } from "./appstate.svelte";
import { updateAfterNoteStateChange } from "./globals";
import {
  Note,
  readAppMeta,
  storeWriteAppMeta,
  storeWriteNoteMeta,
} from "./store";

export const kMetadataName = "__metadata.elaris.json";

/** @typedef {{
    name: string,
    isStarred?: boolean,
}} FunctionMetadata */

/** @typedef {{
  ver: number,
  functions: FunctionMetadata[],
}} Metadata */

/** @type {Metadata} */
let metadata = null;

export function getMetadata() {
  return metadata;
}

/**
 * @returns {FunctionMetadata[]}
 */
function getFunctionsMetadata() {
  metadata.functions = metadata.functions || [];
  return metadata.functions;
}

function saveAppMetadata() {
  return storeWriteAppMeta(metadata);
}

/**
 * @returns {Promise<Metadata>}
 */
export async function loadAppMetadata() {
  console.log("loadAppMetadata: started");
  let s = await readAppMeta();
  if (!s) {
    return {
      ver: 1,
      functions: [],
    };
  }
  metadata = JSON.parse(s);
  console.log("loadAppMetadata: finished", metadata);
  return metadata;
}

/**
 * @param {Note} note
 */
export async function saveNoteMetadata(note) {
  let m = note.getMetadata();
  console.log("saveNoteMetadata:", m);
  await storeWriteNoteMeta(m);
}

/**
 * @param {string} name
 * @param {string} altShortcut - "0" ... "9"
 */
export async function reassignNoteShortcut(name, altShortcut) {
  console.log("reassignNoteShortcut:", name, altShortcut);
  let notes = getNotes();
  for (let note of notes) {
    if (note.name === name) {
      // same note: remove shortcut
      if (note.altShortcut === altShortcut) {
        // already assigned
        note.altShortcut = "";
        console.log("reassignNoteShortcut: removing shortcut from", name);
      } else {
        note.altShortcut = altShortcut;
      }
      await saveNoteMetadata(note);
      continue;
    }
    if (note.altShortcut === altShortcut) {
      // a different note: remove shortcut
      note.altShortcut = "";
      await saveNoteMetadata(note);
    }
  }
  updateAfterNoteStateChange();
}

/**
 * @param {string} name
 */
export async function archiveNote(name) {
  let note = findNoteByName(name);
  note.isArchived = true;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
}

/**
 * @param {string} name
 */
export async function unArchiveNote(name) {
  let note = findNoteByName(name);
  note.isArchived = false;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
}

/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function toggleNoteStarred(name) {
  let note = findNoteByName(name);
  note.isStarred = !note.isStarred;
  await saveNoteMetadata(note);
  updateAfterNoteStateChange();
  return note.isStarred;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isNoteArchived(name) {
  let note = findNoteByName(name);
  return note ? note.isArchived : false;
}

/**
 * @param {string} name
 * @param {boolean} createIfNotExists
 * @returns {FunctionMetadata}
 */
export function getFunctionMeta(name, createIfNotExists = false) {
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

/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function toggleFunctionStarred(name) {
  let m = getFunctionMeta(name, true);
  m.isStarred = !m.isStarred;
  await saveAppMetadata();
  return m.isStarred;
}
