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
  parser?: Parser;
  formatType?: string;
}

export const kLanguages: Language[] = [
  { token: "text", name: "Plain Text", guesslang: null, ext: "txt", inheritIndentation: true },
  { token: "math", name: "Math", guesslang: null, ext: "math.txt", inheritIndentation: true, parser: mathjsLanguage.parser },
  { token: "json", name: "JSON", guesslang: "json", parser: jsonLanguage.parser, formatType: "json" },
  { token: "python", name: "Python", guesslang: "py", parser: pythonLanguage.parser },
  { token: "html", name: "HTML", guesslang: "html", parser: htmlLanguage.parser, formatType: "html" },
  { token: "sql", name: "SQL", guesslang: "sql", inheritIndentation: true, parser: StandardSQL.language.parser },
  { token: "markdown", name: "Markdown", guesslang: "md", parser: markdownLanguage.parser, formatType: "md" },
  { token: "java", name: "Java", guesslang: "java", parser: javaLanguage.parser },
  { token: "lezer", name: "Lezer", guesslang: null, parser: lezerLanguage.parser },
  { token: "php", name: "PHP", guesslang: "php", parser: phpLanguage.parser },
  { token: "css", name: "CSS", guesslang: "css", parser: cssLanguage.parser, formatType: "css" },
  { token: "xml", name: "XML", guesslang: "xml", parser: xmlLanguage.parser },
  { token: "vue", name: "Vue", guesslang: null, parser: vueLanguage.parser },
  { token: "cpp", name: "C++", guesslang: "cpp", parser: cppLanguage.parser },
  { token: "rust", name: "Rust", guesslang: "rs", parser: rustLanguage.parser },
  { token: "csharp", name: "C#", guesslang: "cs", parser: csharpLanguage.parser },
  { token: "svelte", name: "Svelte", guesslang: null, parser: svelteLanguage.parser },
  { token: "ruby", name: "Ruby", guesslang: "rb", parser: StreamLanguage.define(ruby).parser },
  { token: "shell", name: "Shell", guesslang: "sh", parser: StreamLanguage.define(shell).parser },
  { token: "yaml", name: "YAML", guesslang: "yaml", parser: StreamLanguage.define(yaml).parser, formatType: "yaml" },
  { token: "toml", name: "TOML", guesslang: "toml", parser: StreamLanguage.define(toml).parser },
  { token: "golang", name: "Go", guesslang: "go", parser: StreamLanguage.define(go).parser, formatType: "go" },
  { token: "clojure", name: "Clojure", guesslang: "clj", parser: StreamLanguage.define(clojure).parser },
  { token: "erlang", name: "Erlang", guesslang: "erl", parser: StreamLanguage.define(erlang).parser },
  { token: "javascript", name: "JavaScript", guesslang: "js", parser: javascriptLanguage.parser, formatType: "js" },
  { token: "jsx", name: "JSX", guesslang: null, parser: jsxLanguage.parser, formatType: "jsx" },
  { token: "typescript", name: "TypeScript", guesslang: "ts", parser: typescriptLanguage.parser, formatType: "ts" },
  { token: "tsx", name: "TSX", guesslang: null, parser: tsxLanguage.parser, formatType: "tsx" },
  { token: "swift", name: "Swift", guesslang: "swift", parser: StreamLanguage.define(swift).parser },
  { token: "kotlin", name: "Kotlin", guesslang: "kt", parser: StreamLanguage.define(kotlin).parser },
  { token: "groovy", name: "Groovy", guesslang: "groovy", parser: StreamLanguage.define(groovy).parser },
  { token: "diff", name: "Diff", guesslang: null, parser: StreamLanguage.define(diff).parser },
  { token: "powershell", name: "PowerShell", guesslang: "ps1", parser: StreamLanguage.define(powerShell).parser },
  { token: "dart", name: "Dart", guesslang: "dart", parser: StreamLanguage.define(dart).parser },
  { token: "scala", name: "Scala", guesslang: "scala", parser: StreamLanguage.define(scala).parser },
  { token: "lua", name: "Lua", guesslang: "lua", parser: StreamLanguage.define(lua).parser },
  { token: "mermaid", name: "Mermaid", guesslang: null, ext: "mmd", parser: mermaidLanguage.parser },
];

const byToken = new Map(kLanguages.map((language) => [language.token, language]));

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
