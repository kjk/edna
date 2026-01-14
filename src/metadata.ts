import { storeReadFileAsString, storeWriteFile } from "./store";

export const kMetadataName = "__metadata.elaris.json";

export type FunctionMetadata = {
  name: string;
  isStarred?: boolean;
};

export type NoteMetadata = {
  selection?: any;
  foldedRanges?: any;
};

export type Metadata = {
  ver: number;
  functions: FunctionMetadata[];
  notes: Record<string, NoteMetadata>;
};

let metadata: Metadata = null;

export function getMetadata(): Metadata {
  return metadata;
}

function getFunctionsMetadata(): FunctionMetadata[] {
  metadata.functions = metadata.functions || [];
  return metadata.functions;
}

export async function saveAppMetadata(): Promise<void> {
  let s = JSON.stringify(metadata, null, 2);
  await storeWriteFile(kMetadataName, s);
}

export async function loadAppMetadata(): Promise<Metadata> {
  let s = await storeReadFileAsString(kMetadataName);
  let m: Metadata = {
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

export function getFunctionMeta(name: string, createIfNotExists: boolean = false): FunctionMetadata | null {
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
  let m: FunctionMetadata = {
    name: name,
  };
  functions.push(m);
  return m;
}

export async function toggleFunctionStarred(name: string): Promise<boolean> {
  let m = getFunctionMeta(name, true);
  m.isStarred = !m.isStarred;
  await saveAppMetadata();
  return m.isStarred;
}
