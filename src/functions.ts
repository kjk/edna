// based mostly on https://github.com/IvanMathy/Boop/tree/main/Scripts

import { len } from "./util";

export interface BoopFunction {
  api: number;
  name: string;
  author: string;
  description: string;
  icon: string;
  tags: string;
  bias?: number;
  code: string;
}

export interface BoopFunctionArg {
  text: string;
  fullText: string;
  postInfo: (s: string) => void;
  postError: (s: string) => void;
}

export function parseBoopFunction(s: string): BoopFunction | null {
  let metaStart = s.indexOf("/**");
  let metaEnd = s.indexOf("**/");
  if (metaStart < 0 || metaEnd < metaStart) {
    return null;
  }
  let metaStr = s.substring(metaStart + 3, metaEnd);
  let meta = null;
  try {
    meta = JSON.parse(metaStr);
  } catch (e) {
    return null;
  }
  // user-editable: e.g. /**null**/ or a non-string description (U17)
  if (!meta || typeof meta !== "object" || !meta.name || typeof meta.name !== "string") {
    return null;
  }
  for (let k of ["author", "description", "icon", "tags"]) {
    if (k in meta && typeof meta[k] !== "string") {
      meta[k] = String(meta[k]);
    }
  }
  meta.code = s.substring(metaEnd + 3).trim();
  return meta;
}

/**
 * Result of running a function on `content`: the text it changed, or content
 * if nothing changed. Functions are user code: throws if they set text /
 * fullText to something that isn't a string (U17).
 */
export function boopFunctionResult(input: { text: unknown; fullText: unknown }, content: string): string {
  for (let k of ["text", "fullText"] as const) {
    if (typeof input[k] !== "string") {
      throw new Error(`input.${k} must be a string, is ${input[k] === null ? "null" : typeof input[k]}`);
    }
  }
  if (input.fullText !== content) {
    return input.fullText as string;
  }
  return input.text as string;
}

export function parseBuiltInFunctions(s: string): BoopFunction[] {
  let parts = s.split("// ----------------------------");
  let n = len(parts);
  let res: BoopFunction[] = Array(n);
  let i = 0;
  for (let p of parts) {
    let meta = parseBoopFunction(p);
    if (meta) {
      res[i++] = meta;
    }
  }
  res.length = i;
  return res;
}

export function parseUserFunctions(s: string): BoopFunction[] {
  let parts = s.split("\n∞∞∞");
  let n = len(parts);
  let res: BoopFunction[] = Array(n);
  let i = 0;
  for (let p of parts) {
    let lines = p.split("\n");
    // skip the type of the block
    lines = lines.slice(1);
    p = lines.join("\n");
    let meta = parseBoopFunction(p);
    if (meta) {
      res[i++] = meta;
    }
  }
  res.length = i;
  return res;
}

export async function runBoopFunction(f: BoopFunction, arg: BoopFunctionArg): Promise<void> {
  let jsCode =
    f.code +
    `
export const fnMain = main;
  `;
  const blobData = new Blob([jsCode], {
    type: "text/javascript",
  });
  const url = URL.createObjectURL(blobData);
  const mod = await import(/* @vite-ignore */ url);
  await mod.fnMain(arg);
}
