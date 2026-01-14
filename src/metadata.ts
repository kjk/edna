import { storeReadFileAsString, storeWriteFile } from "./store";

export const kMetadataName = "__metadata.elaris.json";

/** @typedef {{
    name: string,
    isStarred?: boolean,
}} FunctionMetadata */

/** @typedef {{
  selection?: any,
  foldedRanges?: any,
}} NoteMetadata */

/** @typedef {{
  ver: number,
  functions: FunctionMetadata[],
  notes: Record<string, NoteMetadata>,
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

export async function saveAppMetadata() {
  let s = JSON.stringify(metadata, null, 2);
  await storeWriteFile(kMetadataName, s);
}

/**
 * @returns {Promise<Metadata>}
 */
export async function loadAppMetadata() {
  let s = await storeReadFileAsString(kMetadataName);
  let m = {
    ver: 1,
    functions: [],
    notes: {},
  };
  if (s) {
    try {
      m = JSON.parse(s);
    } catch (e) {
      console.warn("Failed to parse metadata:", e);
      // if parsing fails, we just return the empty metadata
    }
  }
  console.log("loadAppMetadata", m);
  metadata = m;
  return metadata;
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
