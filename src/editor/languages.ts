import { cppLanguage } from "@codemirror/lang-cpp";
import { cssLanguage } from "@codemirror/lang-css";
import { htmlLanguage } from "@codemirror/lang-html";
import { javaLanguage } from "@codemirror/lang-java";
import {
  javascriptLanguage,
  jsxLanguage,
  tsxLanguage,
  typescriptLanguage,
} from "@codemirror/lang-javascript";
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
import { csharpLanguage } from "@replit/codemirror-lang-csharp";
import { svelteLanguage } from "@replit/codemirror-lang-svelte";

/*
TODO: more langs from @codemirror/legacy-modes/mode/clike
export declare const shader: StreamParser<unknown>
export declare const nesC: StreamParser<unknown>
export declare const objectiveC: StreamParser<unknown>
export declare const objectiveCpp: StreamParser<unknown>
export declare const squirrel: StreamParser<unknown>
export declare const ceylon: StreamParser<unknown>
*/

/** @typedef {{
  token: string,
  name: string,
  guesslang: string,
  ext?: string,
}} Language
 */

/** @type {Language[]} */
export const kLanguages = [
  {
    token: "text",
    name: "Plain Text",
    guesslang: null,
    ext: "txt",
  },
  {
    token: "math",
    name: "Math",
    guesslang: null,
    ext: "math.txt",
  },
  {
    token: "json",
    name: "JSON",
    guesslang: "json",
  },
  {
    token: "python",
    name: "Python",
    guesslang: "py",
  },
  {
    token: "html",
    name: "HTML",
    guesslang: "html",
  },
  {
    token: "sql",
    name: "SQL",
    guesslang: "sql",
  },
  {
    token: "markdown",
    name: "Markdown",
    guesslang: "md",
  },
  {
    token: "java",
    name: "Java",
    guesslang: "java",
  },
  {
    token: "lezer",
    name: "Lezer",
    guesslang: null,
  },
  {
    token: "php",
    name: "PHP",
    guesslang: "php",
  },
  {
    token: "css",
    name: "CSS",
    guesslang: "css",
  },
  {
    token: "xml",
    name: "XML",
    guesslang: "xml",
  },
  {
    token: "vue",
    name: "Vue",
    guesslang: null,
  },
  {
    token: "cpp",
    name: "C++",
    guesslang: "cpp",
  },
  {
    token: "rust",
    name: "Rust",
    guesslang: "rs",
  },
  {
    token: "csharp",
    name: "C#",
    guesslang: "cs",
  },
  {
    token: "svelte",
    name: "Svelte",
    guesslang: null,
  },
  {
    token: "ruby",
    name: "Ruby",
    guesslang: "rb",
  },
  {
    token: "shell",
    name: "Shell",
    guesslang: "sh",
  },
  {
    token: "yaml",
    name: "YAML",
    guesslang: "yaml",
  },
  {
    token: "toml",
    name: "TOML",
    guesslang: "toml",
  },
  {
    token: "golang",
    name: "Go",
    guesslang: "go",
  },
  {
    token: "clojure",
    name: "Clojure",
    guesslang: "clj",
  },
  {
    token: "erlang",
    name: "Erlang",
    guesslang: "erl",
  },
  {
    token: "javascript",
    name: "JavaScript",
    guesslang: "js",
  },
  {
    token: "jsx",
    name: "JSX",
    guesslang: null,
  },
  {
    token: "typescript",
    name: "TypeScript",
    guesslang: "ts",
  },
  {
    token: "tsx",
    name: "TSX",
    guesslang: null,
  },
  {
    token: "swift",
    name: "Swift",
    guesslang: "swift",
  },
  {
    token: "kotlin",
    name: "Kotlin",
    guesslang: "kt",
  },
  {
    token: "groovy",
    name: "Groovy",
    guesslang: "groovy",
  },
  {
    token: "diff",
    name: "Diff",
    guesslang: null,
  },
  {
    token: "powershell",
    name: "PowerShell",
    guesslang: "ps1",
  },
  {
    token: "dart",
    name: "Dart",
    guesslang: "dart",
  },
  {
    token: "scala",
    name: "Scala",
    guesslang: "scala",
  },
  {
    token: "lua",
    name: "Lua",
    guesslang: "lua",
  },
];

export const LANGUAGES = kLanguages;

/**
 * @param {string} lang
 * @returns {string}
 */
export function extForLang(lang) {
  for (let i of kLanguages) {
    let found = lang == i.token || lang == i.name;
    if (!found) {
      continue;
    }
    if (i.ext) {
      return i.ext;
    }
    if (i.guesslang) {
      return i.guesslang;
    }
    return i.token;
  }
  return "txt";
}

function buildTokenToLanguage() {
  let res = {};
  for (let l of kLanguages) {
    res[l.token] = l;
  }
  return res;
}

const tokenToLanguage = buildTokenToLanguage();

export function getLanguage(token) {
  return tokenToLanguage[token];
}

export function getLanguageNameFromToken(token) {
  let lang = getLanguage(token);
  return lang ? lang.name : "Unknown";
}

/**
 * @param {Language} lang
 * @returns {boolean}
 */
export function langSupportsRun(lang) {
  // console.log("langSupportsRun:", lang);
  let token = lang ? lang.token : "";
  switch (token) {
    case "golang":
    case "javascript":
      return true;
  }
  return false;
}

// TODO: should be async to support on-demand loading of parsers
// TODO: StreamLanguage.define() should only happen once
/**
 * @param {Language} lang
 * @returns {any}
 */
export function langGetParser(lang) {
  if (!lang) {
    return null;
  }
  let token = lang.token;
  if (token === "json") {
    return jsonLanguage.parser;
  }
  if (token === "python") {
    return pythonLanguage.parser;
  }
  if (token === "html") {
    return htmlLanguage.parser;
  }
  if (token === "markdown") {
    return markdownLanguage.parser;
  }
  if (token == "sql") {
    return StandardSQL.language.parser;
  }
  if (token === "java") {
    return javaLanguage.parser;
  }
  if (token === "lezer") {
    return lezerLanguage.parser;
  }
  if (token === "php") {
    return phpLanguage.parser;
  }
  if (token === "css") {
    return cssLanguage.parser;
  }
  if (token === "xml") {
    return xmlLanguage.parser;
  }
  if (token === "vue") {
    return vueLanguage.parser;
  }
  if (token === "cpp") {
    return cppLanguage.parser;
  }
  if (token === "rust") {
    return rustLanguage.parser;
  }
  if (token === "csharp") {
    return csharpLanguage.parser;
  }
  if (token === "svelte") {
    return svelteLanguage.parser;
  }
  if (token === "ruby") {
    return StreamLanguage.define(ruby).parser;
  }
  if (token === "shell") {
    return StreamLanguage.define(shell).parser;
  }
  if (token === "yaml") {
    return StreamLanguage.define(yaml).parser;
  }
  if (token === "toml") {
    return StreamLanguage.define(toml).parser;
  }
  if (token === "golang") {
    return StreamLanguage.define(go).parser;
  }
  if (token === "clojure") {
    return StreamLanguage.define(clojure).parser;
  }
  if (token === "erlang") {
    return StreamLanguage.define(erlang).parser;
  }
  if (token === "javascript") {
    return javascriptLanguage.parser;
  }
  if (token === "jsx") {
    return jsxLanguage.parser;
  }
  if (token === "typescript") {
    return typescriptLanguage.parser;
  }
  if (token === "tsx") {
    return tsxLanguage.parser;
  }
  if (token === "swift") {
    return StreamLanguage.define(swift).parser;
  }
  if (token === "kotlin") {
    return StreamLanguage.define(kotlin).parser;
  }
  if (token === "dart") {
    return StreamLanguage.define(dart).parser;
  }
  if (token === "scala") {
    return StreamLanguage.define(scala).parser;
  }
  if (token === "groovy") {
    return StreamLanguage.define(groovy).parser;
  }
  if (token === "diff") {
    return StreamLanguage.define(diff).parser;
  }
  if (token === "powershell") {
    return StreamLanguage.define(powerShell).parser;
  }
  if (token === "lua") {
    return StreamLanguage.define(lua).parser;
  }
  return null;
}

/**
 * @typedef {Object} PrettierInfo
 * @property {string} parser
 * @property {any[]} plugins
 */

/**
 * @param {Language} lang
 * @returns {Promise<PrettierInfo>}
 */
export async function langGetPrettierInfo(lang) {
  if (!lang) {
    return null;
  }

  console.log("getPrettierInfo:", lang.token);
  let token = lang.token;
  if (token == "json") {
    let babelPrettierPlugin = (await import("prettier/plugins/babel.mjs"))
      .default;
    console.log("babelPrettierPlugin:", babelPrettierPlugin);
    // import * as prettierPluginEstree from "prettier/plugins/estree.mjs";
    let prettierPluginEstree = await import("prettier/plugins/estree.mjs");
    console.log("prettierPluginEstree:", prettierPluginEstree);
    return {
      parser: "json-stringify",
      plugins: [babelPrettierPlugin, prettierPluginEstree],
    };
  }
  if (token === "html") {
    // import htmlPrettierPlugin from "prettier/esm/parser-html.mjs";
    let htmlPrettierPlugin = (await import("prettier/plugins/html.mjs"))
      .default;
    console.log("htmlPrettierPlugin:", htmlPrettierPlugin);
    return {
      parser: "html",
      plugins: [htmlPrettierPlugin],
    };
  }

  if (token === "markdown") {
    // import markdownPrettierPlugin from "prettier/esm/parser-markdown.mjs";
    let markdownPrettierPlugin = (await import("prettier/plugins/markdown.mjs"))
      .default;
    console.log("markdownPrettierPlugin:", markdownPrettierPlugin);
    return {
      parser: "markdown",
      plugins: [markdownPrettierPlugin],
    };
  }

  if (token === "css") {
    let cssPrettierPlugin = (await import("prettier/plugins/postcss.mjs"))
      .default;
    console.log("cssPrettierPlugin:", cssPrettierPlugin);
    return {
      parser: "css",
      plugins: [cssPrettierPlugin],
    };
  }

  if (token === "yaml") {
    // import yamlPrettierPlugin from "prettier/plugins/yaml.mjs";
    let yamlPrettierPlugin = (await import("prettier/plugins/yaml.mjs"))
      .default;
    console.log("yamlPrettierPlugin:", yamlPrettierPlugin);
    return {
      parser: "yaml",
      plugins: [yamlPrettierPlugin],
    };
  }

  if (token === "javascript" || token === "jsx") {
    let babelPrettierPlugin = (await import("prettier/plugins/babel.mjs"))
      .default;
    console.log("babelPrettierPlugin:", babelPrettierPlugin);
    // import * as prettierPluginEstree from "prettier/plugins/estree.mjs";
    let prettierPluginEstree = await import("prettier/plugins/estree.mjs");
    console.log("prettierPluginEstree:", prettierPluginEstree);
    return {
      parser: "babel",
      plugins: [babelPrettierPlugin, prettierPluginEstree],
    };
  }

  if (token === "typescript" || token === "tsx") {
    let typescriptPlugin = (await import("prettier/plugins/typescript.mjs"))
      .default;
    console.log("typescriptPlugin:", typescriptPlugin);
    // import * as prettierPluginEstree from "prettier/plugins/estree.mjs";
    let prettierPluginEstree = await import("prettier/plugins/estree.mjs");
    console.log("prettierPluginEstree:", prettierPluginEstree);
    return {
      parser: "typescript",
      plugins: [typescriptPlugin, prettierPluginEstree],
    };
  }
  return null;
}

/**
 * @param {Language} lang
 * @returns {boolean}
 */
export function langSupportsFormat(lang) {
  if (!lang) {
    return false;
  }
  if (lang.token == "golang") {
    return true;
  }
  switch (lang.token) {
    case "json":
    case "html":
    case "markdown":
    case "css":
    case "yaml":
    case "javascript":
    case "jsx":
    case "typescript":
    case "tsx":
      return true;
  }
  return false;
}
