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
  if (metaStart < 0 && metaEnd < 0) {
    return null;
  }
  let metaStr = s.substring(metaStart + 3, metaEnd);
  let meta = null;
  try {
    meta = JSON.parse(metaStr);
  } catch (e) {
    return null;
  }
  if (!meta.name || typeof meta.name !== "string") {
    return null;
  }
  meta.code = s.substring(metaEnd + 3).trim();
  return meta;
}

export function findFunctionByName(funcs: BoopFunction[], name: string): BoopFunction | null {
  for (let f of funcs) {
    if (f.name === name) {
      return f;
    }
  }
  return null;
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
  console.log(mod);
  await mod.fnMain(arg);
}
