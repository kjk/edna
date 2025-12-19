// based mostly on https://github.com/IvanMathy/Boop/tree/main/Scripts

import { len } from "./util";

/** @typedef {{
  api: number,
  name: string,
  author: string,
  description: string,
  icon: string,
  tags: string,
  bias?: number,
  code: string,
}} BoopFunction */

/** @typedef {{
 text: string,
 fullText: string,
 postInfo: (s: string) => void,
 postError: (s: string) => void,
}} BoopFunctionArg */

/**
 * @param {string} s
 * @returns {BoopFunction}
 */
export function parseBoopFunction(s) {
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

/**
 * @param {BoopFunction[]} funcs
 * @param {string} name
 * @returns {BoopFunction}
 */
export function findFunctionByName(funcs, name) {
  for (let f of funcs) {
    if (f.name === name) {
      return f;
    }
  }
  return null;
}

/**
 * @param {string} s
 * @returns {BoopFunction[]}
 */
export function parseBuiltInFunctions(s) {
  let parts = s.split("// ----------------------------");
  let n = len(parts);
  /** @type {BoopFunction[]} */
  let res = Array(n);
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

/**
 * @param {string} s
 * @returns {BoopFunction[]}
 */
export function parseUserFunctions(s) {
  let parts = s.split("\n∞∞∞");
  let n = len(parts);
  /** @type {BoopFunction[]} */
  let res = Array(n);
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

/**
 * @param {BoopFunction} f
 * @param {BoopFunctionArg} arg
 * @return {Promise<void>}
 */
export async function runBoopFunction(f, arg) {
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
