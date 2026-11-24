// based mostly on https://github.com/IvanMathy/Boop/tree/main/Scripts

import { getBlocksFromString } from "./editor/block/block-parsing";
import { fixUpNoteContent } from "./note-content";
import { len, tryParseJSON } from "./util";

export interface BoopFunction {
  api: number;
  name: string;
  author: string;
  description: string;
  icon: string;
  tags: string;
  bias?: number;
  // api 2: "cursor" means input.text is the selection (empty if there's none)
  // and the output is inserted at cursor position, replacing the selection (#52).
  // Otherwise the output goes into a new block or replaces block / selection
  output?: string;
  code: string;
}

// true if output of f is inserted at cursor position
export function isCursorFunction(f: BoopFunction): boolean {
  return f.api >= 2 && f.output === "cursor";
}

export interface BoopFunctionArg {
  text: string;
  fullText: string;
  postInfo: (s: string) => void;
  postError: (s: string) => void;
  // asks the user for values of arguments; null if cancelled (#60)
  getArgumentsFromUser: (schema: unknown) => Promise<Record<string, string | number | boolean> | null>;
}

// type of a function argument entered by the user
export type ArgType = "string" | "text" | "number" | "boolean";
const kArgTypes: ArgType[] = ["string", "text", "number", "boolean"];

export interface ArgSpec {
  name: string;
  type: ArgType;
  description: string;
}

/**
 * Argument schema passed by a function to getArgumentsFromUser():
 * [[name, type, description], ...]. type is "string" (default), "text"
 * (multi-line), "number" or "boolean". Functions are user code: throws
 * a descriptive error if the schema is invalid
 */
export function parseArgSchema(schema: unknown): ArgSpec[] {
  if (!Array.isArray(schema) || schema.length === 0) {
    throw new Error("getArgumentsFromUser: schema must be a non-empty array of [name, type, description]");
  }
  let res: ArgSpec[] = [];
  for (let el of schema) {
    let a = Array.isArray(el) ? el : [el];
    let [name, type = "string", description = ""] = a;
    if (typeof name !== "string" || name === "") {
      throw new Error(`getArgumentsFromUser: invalid argument name ${JSON.stringify(name)}`);
    }
    if (res.some((s) => s.name === name)) {
      throw new Error(`getArgumentsFromUser: duplicate argument '${name}'`);
    }
    if (!kArgTypes.includes(type)) {
      throw new Error(`getArgumentsFromUser: argument '${name}' has invalid type ${JSON.stringify(type)}, must be one of ${kArgTypes.join(", ")}`);
    }
    res.push({ name, type, description: String(description) });
  }
  return res;
}

/**
 * Converts values entered in the arguments form to their types.
 * Returns { values } or { error } describing the first invalid value
 */
export function convertArgValues(
  specs: ArgSpec[],
  raw: Record<string, string | boolean>,
): { values: Record<string, string | number | boolean> } | { error: string } {
  let values: Record<string, string | number | boolean> = {};
  for (let spec of specs) {
    let v = raw[spec.name];
    if (spec.type === "boolean") {
      values[spec.name] = !!v;
      continue;
    }
    let s = typeof v === "string" ? v : "";
    if (spec.type === "number") {
      let n = Number(s.trim());
      if (s.trim() === "" || !Number.isFinite(n)) {
        return { error: `'${spec.name}' must be a number` };
      }
      values[spec.name] = n;
      continue;
    }
    values[spec.name] = s;
  }
  return { values };
}

export function parseBoopFunction(s: string): BoopFunction | null {
  let metaStart = s.indexOf("/**");
  let metaEnd = s.indexOf("**/");
  if (metaStart < 0 || metaEnd < metaStart) {
    return null;
  }
  let metaStr = s.substring(metaStart + 3, metaEnd);
  let meta: any = tryParseJSON(metaStr, "function metadata");
  // user-editable: e.g. /**null**/ or a non-string description (U17)
  if (!meta || typeof meta !== "object" || !meta.name || typeof meta.name !== "string") {
    return null;
  }
  for (let k of ["author", "description", "icon", "tags", "output"]) {
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

// separates functions in the built-in functions file
export const kBuiltInFunctionsSeparator = "// ----------------------------";

// boop functions parsed from parts, skipping parts that aren't functions
function parseBoopFunctions(parts: string[]): BoopFunction[] {
  return parts.map(parseBoopFunction).filter((f) => !!f) as BoopFunction[];
}

export function parseBuiltInFunctions(s: string): BoopFunction[] {
  return parseBoopFunctions(s.split(kBuiltInFunctionsSeparator));
}

export function parseUserFunctions(s: string): BoopFunction[] {
  // each block is a function
  s = fixUpNoteContent(s);
  return parseBoopFunctions(getBlocksFromString(s).map((b) => s.slice(b.contentFrom, b.to)));
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
