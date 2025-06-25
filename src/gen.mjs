import fs from "node:fs";
import path from "node:path";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { keyHelpStr } from "./key-helper.js";

console.log(
  "Generating html-win.html and html-mac.html from note-help.edna.txt",
);

/**
 * @param {string} platform
 * @returns {string}
 */
export function getModChar(platform) {
  return platform === "darwin" ? "⌘" : "Ctrl";
}

/**
 * @param {string} platform
 * @returns {string}
 */
export function getAltChar(platform) {
  return platform === "darwin" ? "⌥" : "Alt";
}

/**
 * @param {string} s
 * @param {string} platform
 * @returns {string}
 */
function fixUpShortcuts(s, platform) {
  let modChar = getModChar(platform);
  let altChar = getAltChar(platform);
  s = s.replace(/Alt/g, altChar);
  s = s.replace(/Mod/g, modChar);
  return s;
}

/**
 * @param {string[]} lines
 * @param {string} s
 * @returns {string[]}
 */
function removeLineStartingWith(lines, s) {
  return lines.filter((line) => !line.startsWith(s));
}

/**
 * @param {string[]} lines
 * @returns {string[]}
 */
function replaceJSBlock(lines) {
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

/**
 * @param {string[]} lines
 * @returns {string[]}
 */
function removeMathBlock(lines) {
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

/**
 * @param {string[]} lines
 * @returns {string[]}
 */
function collapseMultipleEmptyLines(lines) {
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

/**
 * @param {string} platform
 * @returns {string}
 */
function getHelp(platform) {
  let path = "./src/notes/note-help.edna.txt";
  let helpRaw = fs.readFileSync(path, "utf8");

  let lines = helpRaw.split("\n");
  lines = removeMathBlock(lines);
  lines = replaceJSBlock(lines);
  lines = removeLineStartingWith(lines, "∞∞∞markdown");
  lines = removeLineStartingWith(lines, "This is a help note");
  lines = removeLineStartingWith(lines, "To see help in HTML");
  lines = collapseMultipleEmptyLines(lines);
  helpRaw = lines.join("\n");

  let keyHelp = keyHelpStr(platform);
  keyHelp = "```\n" + keyHelp + "\n```";

  let help = fixUpShortcuts(helpRaw, platform);
  help = help.replace("{{keyHelp}}", keyHelp);
  // link Edna to website
  // help = help.replace(/Edna/g, "[Edna](https://edna.arslexis.io)");
  return help;
}

/**
 * @param {string} s
 * @returns {string}
 */
function cleanMd(s) {
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

/**
 * @param {markdownIt} md
 */
function addTargetBlank(md) {
  // Remember old renderer, if overridden, or proxy to default renderer
  var defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    // If you are using linkify to automatically detect links, you might want to
    // check if it's an external link here. You can do so based on tokens[idx].href

    // Add target="_blank" to links except the internal #foo links
    let token = tokens[idx];
    // console.log("token:", token);
    // console.log("token.attrs:", token.attrs);
    let aidx = token.attrIndex("href");
    let uri = token.attrs[aidx][1];
    if (uri.startsWith("#")) {
      // console.log("skipping uri: ", uri);
      return defaultRender(tokens, idx, options, env, self);
    }
    aidx = token.attrIndex("target");
    if (aidx < 0) {
      token.attrPush(["target", "_blank"]); // add new attribute
    } else {
      token.attrs[aidx][1] = "_blank"; // replace existing attribute
    }
    // console.log("added to uri: ", uri);
    // pass token to default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };
}

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
