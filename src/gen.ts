import fs from "node:fs";
import path from "node:path";
import markdownIt, { type MarkdownIt } from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { fixUpShortcutsInCode, keyHelpStr } from "./key-helper.js";
import { addTargetBlank } from "./markdown-util.js";

console.log(
  "Generating help-win.html and help-mac.html from note-help.edna.txt",
);

function removeLineStartingWith(lines: string[], s: string): string[] {
  return lines.filter((line) => !line.startsWith(s));
}

function replaceJSBlock(lines: string[]): string[] {
  let res = [];
  let inJS = false;
  for (let s of lines) {
    if (!inJS) {
      if (s.startsWith("∞∞∞javascript")) {
        inJS = true;
        // console.log(s);
        res.push("```js");
      } else {
        res.push(s);
      }
      continue;
    }

    // inJS
    // console.log(s);
    if (s.startsWith("∞∞∞")) {
      inJS = false;
      res.push("```");
      continue;
    }
    res.push(s);
  }
  return res;
}

function removeMathBlock(lines: string[]): string[] {
  let res = [];
  let inMath = false;
  for (let s of lines) {
    if (inMath) {
      if (s.startsWith("∞∞∞")) {
        inMath = false;
        res.push(s);
      }
    } else {
      if (s.startsWith("∞∞∞math")) {
        inMath = true;
      } else {
        res.push(s);
      }
    }
  }
  return res;
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

  let keyHelp = keyHelpStr(platform);
  keyHelp = "```\n" + keyHelp + "\n```";

  let help = fixUpShortcutsInCode(helpRaw, platform);
  help = help.replace("{{keyHelp}}", keyHelp);
  // link Edna to website
  // help = help.replace(/Edna/g, "[Edna](https://edna.arslexis.io)");
  return help;
}

function cleanMd(s: string): string {
  let lines = s.split("\n");
  lines = lines.filter((line) => !line.startsWith("∞∞∞"));
  let res = lines.join("\n");
  return res;
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
  let md = markdownIt({
    linkify: true,
  });
  md.use(addTargetBlank);
  md.use(markdownItAnchor, {
    // Here you can pass options to markdown-it-anchor
    // For example, setting the permalink option:
    permalink: markdownItAnchor.permalink.headerLink(),
  });

  {
    let mdText = cleanMd(getHelp("windows"));
    let htmlText = md.render(mdText);
    htmlText = htmlStart + htmlText + htmlEnd;
    let fpath = path.join("src", "public", "help-win.html");
    fs.writeFileSync(fpath, htmlText);
    console.log("wrote", fpath);
  }
  {
    let mdText = cleanMd(getHelp("darwin"));
    let htmlText = md.render(mdText);
    htmlText = htmlStart + htmlText + htmlEnd;
    let fpath = path.join("src", "public", "help-mac.html");
    fs.writeFileSync(fpath, htmlText);
    console.log("wrote", fpath);
  }
}

genHTMLFromMarkdown();
