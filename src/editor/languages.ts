import { cppLanguage } from "@codemirror/lang-cpp";
import { cssLanguage } from "@codemirror/lang-css";
import { htmlLanguage } from "@codemirror/lang-html";
import { javaLanguage } from "@codemirror/lang-java";
import { javascriptLanguage, jsxLanguage, tsxLanguage, typescriptLanguage } from "@codemirror/lang-javascript";
import { jsonLanguage } from "@codemirror/lang-json";
import { lezerLanguage } from "@codemirror/lang-lezer";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { phpLanguage } from "@codemirror/lang-php";
import { pythonLanguage } from "@codemirror/lang-python";
import { rustLanguage } from "@codemirror/lang-rust";
import { StandardSQL } from "@codemirror/lang-sql";
import { vueLanguage } from "@codemirror/lang-vue";
import { xmlLanguage } from "@codemirror/lang-xml";
import { StreamLanguage } from "@codemirror/language";
import { dart, kotlin, scala } from "@codemirror/legacy-modes/mode/clike";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { go } from "@codemirror/legacy-modes/mode/go";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import type { Parser } from "@lezer/common";
import { csharpLanguage } from "@replit/codemirror-lang-csharp";
import { svelteLanguage } from "@replit/codemirror-lang-svelte";
import { mermaidLanguage } from "codemirror-lang-mermaid";
import { mathjsLanguage } from "heynote-lang-mathjs";

export interface Language {
  token: string;
  name: string;
  guesslang: string | null;
  ext?: string;
  inheritIndentation?: boolean;
}

export const kLanguages: Language[] = [
  { token: "text", name: "Plain Text", guesslang: null, ext: "txt", inheritIndentation: true },
  { token: "math", name: "Math", guesslang: null, ext: "math.txt", inheritIndentation: true },
  { token: "json", name: "JSON", guesslang: "json" },
  { token: "python", name: "Python", guesslang: "py" },
  { token: "html", name: "HTML", guesslang: "html" },
  { token: "sql", name: "SQL", guesslang: "sql", inheritIndentation: true },
  { token: "markdown", name: "Markdown", guesslang: "md" },
  { token: "java", name: "Java", guesslang: "java" },
  { token: "lezer", name: "Lezer", guesslang: null },
  { token: "php", name: "PHP", guesslang: "php" },
  { token: "css", name: "CSS", guesslang: "css" },
  { token: "xml", name: "XML", guesslang: "xml" },
  { token: "vue", name: "Vue", guesslang: null },
  { token: "cpp", name: "C++", guesslang: "cpp" },
  { token: "rust", name: "Rust", guesslang: "rs" },
  { token: "csharp", name: "C#", guesslang: "cs" },
  { token: "svelte", name: "Svelte", guesslang: null },
  { token: "ruby", name: "Ruby", guesslang: "rb" },
  { token: "shell", name: "Shell", guesslang: "sh" },
  { token: "yaml", name: "YAML", guesslang: "yaml" },
  { token: "toml", name: "TOML", guesslang: "toml" },
  { token: "golang", name: "Go", guesslang: "go" },
  { token: "clojure", name: "Clojure", guesslang: "clj" },
  { token: "erlang", name: "Erlang", guesslang: "erl" },
  { token: "javascript", name: "JavaScript", guesslang: "js" },
  { token: "jsx", name: "JSX", guesslang: null },
  { token: "typescript", name: "TypeScript", guesslang: "ts" },
  { token: "tsx", name: "TSX", guesslang: null },
  { token: "swift", name: "Swift", guesslang: "swift" },
  { token: "kotlin", name: "Kotlin", guesslang: "kt" },
  { token: "groovy", name: "Groovy", guesslang: "groovy" },
  { token: "diff", name: "Diff", guesslang: null },
  { token: "powershell", name: "PowerShell", guesslang: "ps1" },
  { token: "dart", name: "Dart", guesslang: "dart" },
  { token: "scala", name: "Scala", guesslang: "scala" },
  { token: "lua", name: "Lua", guesslang: "lua" },
  { token: "mermaid", name: "Mermaid", guesslang: null, ext: "mmd" },
];

const byToken = new Map(kLanguages.map((language) => [language.token, language]));
const parsers = new Map(
  Object.entries({
    math: mathjsLanguage,
    json: jsonLanguage,
    python: pythonLanguage,
    html: htmlLanguage,
    sql: StandardSQL.language,
    markdown: markdownLanguage,
    java: javaLanguage,
    lezer: lezerLanguage,
    php: phpLanguage,
    css: cssLanguage,
    xml: xmlLanguage,
    vue: vueLanguage,
    cpp: cppLanguage,
    rust: rustLanguage,
    csharp: csharpLanguage,
    svelte: svelteLanguage,
    javascript: javascriptLanguage,
    jsx: jsxLanguage,
    typescript: typescriptLanguage,
    tsx: tsxLanguage,
    mermaid: mermaidLanguage,
  }).map(([token, language]) => [token, language.parser]),
);
const streams = new Map(
  Object.entries({
    ruby,
    shell,
    yaml,
    toml,
    golang: go,
    clojure,
    erlang,
    swift,
    kotlin,
    groovy,
    diff,
    powershell: powerShell,
    dart,
    scala,
    lua,
  }).map(([token, mode]) => [token, StreamLanguage.define(mode).parser]),
);

export function getLanguage(token: string): Language | undefined {
  return byToken.get(token);
}

export function extForLang(lang: string): string {
  const language = getLanguage(lang) ?? kLanguages.find(({ name }) => name === lang);
  return language ? (language.ext ?? language.guesslang ?? language.token) : "txt";
}

export function getLanguageNameFromToken(token: string): string {
  return getLanguage(token)?.name ?? "Unknown";
}

export function langGetParser(lang: Language | undefined): Parser | null {
  if (!lang) return null;
  return parsers.get(lang.token) ?? streams.get(lang.token) ?? null;
}

export function langSupportsRun(lang: Language | undefined): lang is Language {
  return lang?.token === "javascript" || lang?.token === "golang";
}

export interface PrettierInfo {
  parser: string;
  plugins: NonNullable<import("prettier").Options["plugins"]>;
}

const babel = () => import("prettier/plugins/babel");
const estree = () => import("prettier/plugins/estree");
const typescript = () => import("prettier/plugins/typescript");
const postcss = () => import("prettier/plugins/postcss");
const prettierHTML = () => import("prettier/plugins/html");
const prettierMarkdown = () => import("prettier/plugins/markdown");
const prettierYAML = () => import("prettier/plugins/yaml");

const formatters = new Map<string, { parser: string; plugins: (() => Promise<PrettierInfo["plugins"][number]>)[] }>([
  ["javascript", { parser: "babel", plugins: [babel, estree] }],
  ["jsx", { parser: "babel", plugins: [babel, estree] }],
  ["json", { parser: "json-stringify", plugins: [babel, estree] }],
  ["typescript", { parser: "typescript", plugins: [typescript, estree] }],
  ["tsx", { parser: "typescript", plugins: [typescript, estree] }],
  ["css", { parser: "css", plugins: [postcss] }],
  ["html", { parser: "html", plugins: [prettierHTML] }],
  ["markdown", { parser: "markdown", plugins: [prettierMarkdown] }],
  ["yaml", { parser: "yaml", plugins: [prettierYAML] }],
]);

export async function langGetPrettierInfo(lang: Language | undefined): Promise<PrettierInfo | null> {
  const formatter = lang && formatters.get(lang.token);
  if (!formatter) return null;
  const plugins = await Promise.all(formatter.plugins.map((load) => load()));
  return { parser: formatter.parser, plugins };
}

export function langSupportsFormat(lang: Language | undefined): boolean {
  return !!lang && (lang.token === "golang" || formatters.has(lang.token));
}
