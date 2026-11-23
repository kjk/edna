import markdownIt, { type MarkdownIt } from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";

// markdown-it with linkify, links opening in a new tab and anchors for headers
export function newMarkdownIt(opts: { highlight?: (str: string, lang: string) => string } = {}): MarkdownIt {
  let md = markdownIt({ linkify: true, ...opts });
  md.use(addTargetBlank);
  md.use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink(),
  });
  return md;
}

// markdown-it plugin: add target="_blank" to links except the internal #foo links
export function addTargetBlank(md: MarkdownIt) {
  // Remember old renderer, if overridden, or proxy to default renderer
  var defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, env, self) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    // If you are using linkify to automatically detect links, you might want to
    // check if it's an external link here. You can do so based on tokens[idx].href
    let token = tokens[idx]!;
    let aidx = token.attrIndex("href");
    let uri = String(token.attrs![aidx]![1]);
    if (uri.startsWith("#")) {
      return defaultRender(tokens, idx, options, env, self);
    }
    aidx = token.attrIndex("target");
    if (aidx < 0) {
      token.attrPush(["target", "_blank"]); // add new attribute
    } else {
      token.attrs![aidx]![1] = "_blank"; // replace existing attribute
    }
    // pass token to default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };
}

export interface MarkdownHeading {
  level: number;
  text: string;
  // offset of the start of heading's line in the markdown text
  offset: number;
}

// h1 ... h{maxLevel} headings of markdown text s, in order. Uses a real parser
// so that e.g. "# comment" in a code fence isn't a heading
export function getMarkdownHeadings(s: string, maxLevel = 4): MarkdownHeading[] {
  let lineStarts = [0];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }
  let res: MarkdownHeading[] = [];
  let tokens = markdownIt().parse(s, {});
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i]!;
    if (t.type !== "heading_open" || !t.map) {
      continue;
    }
    let level = Number(t.tag.slice(1));
    if (level > maxLevel) {
      continue;
    }
    let text = tokens[i + 1]?.content.trim() || "(empty)";
    res.push({ level, text, offset: lineStarts[t.map[0]] ?? 0 });
  }
  return res;
}
