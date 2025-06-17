import { tick } from "svelte";
import { fsReadTextFile, fsWriteTextFile } from "./fileutil";
import { getStorageFS } from "./notes";
import { updateStarred, updateWithShortcuts } from "./state.svelte";

export const kMetadataName = "__metadata.edna.json";

/** @typedef {{
    name: string,
    altShortcut?: string,
    isStarred?: boolean,
}} NoteMetadata */

/** @typedef {{
    name: string,
    isStarred?: boolean,
}} FunctionMetadata */

/** @typedef {{
  ver: number,
  notes: NoteMetadata[],
  functions: FunctionMetadata[],
}} Metadata */

/** @type {Metadata} */
let metadata = null;

export function getMetadata() {
  return metadata;
}

/**
 * @returns {NoteMetadata[]}
 */
export function getNotesMetadata() {
  metadata.notes = metadata.notes || [];
  return metadata.notes;
}

/**
 * @returns {FunctionMetadata[]}
 */
function getFunctionsMetadata() {
  metadata.functions = metadata.functions || [];
  return metadata.functions;
}

/**
 * @returns {Promise<Metadata>}
 */
export async function loadNotesMetadata() {
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
  return metadata;
}

/**
 * @param {Metadata} m
 */
async function saveNotesMetadata(m) {
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

/**
 * can return null if there is no metadata
 * @param {string} name
 * @param {boolean} createIfNotExists
 * @returns {NoteMetadata}
 */
export function getNoteMeta(name, createIfNotExists = false) {
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

/** @typedef {(meta: NoteMetadata) => void} UpdateNoteMetadataFn */

/**
 * @param {string} name
 * @param {UpdateNoteMetadataFn} updateMetaFn
 * @param {boolean} save
 * @returns {Promise<Metadata>}
 */
export async function updateNoteMeta(name, updateMetaFn, save = false) {
  let meta = getNoteMeta(name, true);
  updateMetaFn(meta);
  let res = metadata;
  if (save) {
    res = await saveNotesMetadata(metadata);
  }
  return res;
}

/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function toggleNoteStarred(name) {
  let isStarred = false;
  await updateNoteMeta(
    name,
    (m) => {
      m.isStarred = !m.isStarred;
      isStarred = m.isStarred;
    },
    true,
  );
  tick().then(updateStarred);
  return isStarred;
}

/**
 * @param {string} name
 */
export async function removeNoteFromMetadata(name) {
  console.log("deleteMetadataForNote:", name);
  let notes = getNotesMetadata();
  let newNotes = [];
  for (let m of notes) {
    if (m.name !== name) {
      newNotes.push(m);
    }
  }
  metadata.notes = newNotes;
  await saveNotesMetadata(metadata);
}

/**
 * @param {string} oldName
 * @param {string} newName
 * @returns {Promise<Metadata>}
 */
export async function renameNoteInMetadata(oldName, newName) {
  let notes = getNotesMetadata();
  for (let o of notes) {
    if (o.name === oldName) {
      o.name = newName;
      break;
    }
  }
  let res = await saveNotesMetadata(metadata);
  return res;
}

/**
 * @param {string} name
 * @param {string} altShortcut - "0" ... "9"
 * @returns {Promise<Metadata>}
 */
export async function reassignNoteShortcut(name, altShortcut) {
  console.log("reassignNoteShortcut:", name, altShortcut);
  let notes = getNotesMetadata();
  for (let o of notes) {
    if (o.altShortcut !== altShortcut) {
      continue;
    }
    if (o.name === name) {
      // same note: just remove shortcut
      delete o.altShortcut;
      let res = await saveNotesMetadata(metadata);
      return res;
    } else {
      // a different note: remove shortcut and then assign to the new note
      delete o.altShortcut;
    }
  }

  let res = await updateNoteMeta(
    name,
    (meta) => {
      meta.altShortcut = altShortcut;
    },
    true,
  );
  tick().then(updateWithShortcuts);
  return res;
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

/** @typedef {(meta: FunctionMetadata) => void} UpdateFunctionMetadataFn */

/**
 * @param {string} name
 * @param {UpdateFunctionMetadataFn} updateFn
 * @param {boolean} save
 * @returns {Promise<Metadata>}
 */
export async function updateFunctionMeta(name, updateFn, save = false) {
  let meta = getFunctionMeta(name, true);
  updateFn(meta);
  let res = metadata;
  if (save) {
    res = await saveNotesMetadata(metadata);
  }
  return res;
}

/**
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function toggleFunctionStarred(name) {
  let isStarred = false;
  await updateFunctionMeta(
    name,
    (m) => {
      m.isStarred = !m.isStarred;
      isStarred = m.isStarred;
    },
    true,
  );
  return isStarred;
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
