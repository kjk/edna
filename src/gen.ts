import fs from "node:fs";
import path from "node:path";
import { expandKeyHelp } from "./key-helper.js";
import { newMarkdownIt } from "./markdown-util.js";

console.log(
  "Generating help-win.html and help-mac.html from note-help.edna.txt",
);

function removeLineStartingWith(lines: string[], s: string): string[] {
  return lines.filter((line) => !line.startsWith(s));
}

// rewrites blocks of language lang: the header line is replaced by start,
// content lines are kept if keepContent, and the next header line is replaced
// by end(header)
function rewriteBlocks(
  lines: string[],
  lang: string,
  rw: { start: string[]; keepContent: boolean; end: (header: string) => string[] },
): string[] {
  let res: string[] = [];
  let inBlock = false;
  for (let s of lines) {
    if (!inBlock) {
      if (s.startsWith("∞∞∞" + lang)) {
        inBlock = true;
        res.push(...rw.start);
      } else {
        res.push(s);
      }
    } else if (s.startsWith("∞∞∞")) {
      inBlock = false;
      res.push(...rw.end(s));
    } else if (rw.keepContent) {
      res.push(s);
    }
  }
  return res;
}

// javascript blocks become markdown code blocks
function replaceJSBlock(lines: string[]): string[] {
  return rewriteBlocks(lines, "javascript", { start: ["```js"], keepContent: true, end: () => ["```"] });
}

function removeMathBlock(lines: string[]): string[] {
  return rewriteBlocks(lines, "math", { start: [], keepContent: false, end: (header) => [header] });
}

function collapseMultipleEmptyLines(lines: string[]): string[] {
  let newLines = [];
  let lastLineWasEmpty = false;
  for (let line of lines) {
    if (line === "") {
      if (!lastLineWasEmpty) {
        newLines.push(line);
        lastLineWasEmpty = true;
      }
    } else {
      newLines.push(line);
      lastLineWasEmpty = false;
    }
  }
  return newLines;
}

function getHelp(platform: string): string {
  let path = "./src/notes/note-help.edna.txt";
  let helpRaw = fs.readFileSync(path, "utf8");

  let lines = helpRaw.split("\n");
  lines = removeMathBlock(lines);
  lines = replaceJSBlock(lines);
  lines = removeLineStartingWith(lines, "∞∞∞markdown");
  lines = removeLineStartingWith(lines, "This is a help note");
  lines = removeLineStartingWith(lines, "To see help in");
  lines = collapseMultipleEmptyLines(lines);
  helpRaw = lines.join("\n");

  let help = expandKeyHelp(helpRaw, platform, true);
  // link Edna to website
  // help = help.replace(/Edna/g, "[Edna](https://edna.arslexis.io)");
  return help;
}

function cleanMd(s: string): string {
  return removeLineStartingWith(s.split("\n"), "∞∞∞").join("\n");
}

let htmlStart = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <base href="/help">
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';">
    <meta name="color-scheme" content="light dark">
    <title>Edna Help</title>
    <link rel="stylesheet" href="help.css">
  </head>
  <body>
    <div class="content">
  `;

let htmlEnd = `
    </div>
  <script src="/help.js" defer></script>
  </body>
</html>
`;

function genHTMLFromMarkdown() {
  let md = newMarkdownIt();
  for (let [platform, fileName] of [
    ["windows", "help-win.html"],
    ["darwin", "help-mac.html"],
  ]) {
    let mdText = cleanMd(getHelp(platform!));
    let htmlText = htmlStart + md.render(mdText) + htmlEnd;
    let fpath = path.join("src", "public", fileName!);
    fs.writeFileSync(fpath, htmlText);
    console.log("wrote", fpath);
  }
}

genHTMLFromMarkdown();
