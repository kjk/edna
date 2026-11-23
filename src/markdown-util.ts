import type { MarkdownIt } from "markdown-it";

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
