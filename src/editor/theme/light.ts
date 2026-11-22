import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { flowchartTags, mermaidTags } from "codemirror-lang-mermaid";

const lightTheme = EditorView.theme({
  "&": {
    color: "#444",
    colorScheme: "light",
    backgroundColor: "#fff",
    "--edna-panel": "#f4f4f8",
    "--edna-block-even": "#fff",
    "--edna-block-odd": "#f4f4f8",
    "--edna-divider": "#0000001d",
    "--edna-link": "#226cb3",
    "--edna-result-text": "#fff",
    "--edna-result-background": "#487eb5",
    "--edna-fold-marker": "#666",
    "--edna-fold-background": "#00000012",
    "--edna-fold-text": "#555",
  },
  ".cm-gutters": { backgroundColor: "#0000000a", color: "#00000040", borderRight: "1px solid #00000012" },
  ".cm-activeLine": { backgroundColor: "#0000000a" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#444" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#333" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "#bdd9f9" },
  ".cm-content ::selection": { backgroundColor: "#bdd9f9" },
  ".cm-searchMatch": { backgroundColor: "#ffe782" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#ffcf55" },
});

const lightHighlight = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.modifier, tags.definitionKeyword, mermaidTags.diagramName, flowchartTags.diagramName],
    color: "#8000a0",
  },
  { tag: [tags.number, tags.bool, tags.atom, tags.null, tags.special(tags.variableName)], color: "#006648" },
  { tag: [tags.string, tags.regexp, tags.escape], color: "#ad2336" },
  { tag: [tags.comment, tags.meta], color: "#697578", fontStyle: "italic" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#286375" },
  {
    tag: [tags.definition(tags.variableName), tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "#00f",
  },
  { tag: [tags.tagName, tags.attributeName, tags.propertyName], color: "#125a96" },
  { tag: [tags.heading, tags.strong], fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "#226cb3", textDecoration: "underline" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.invalid, color: "#c22130" },
]);

export const ednaLight = [
  EditorView.editorAttributes.of({ class: "light-theme" }),
  lightTheme,
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  syntaxHighlighting(lightHighlight),
];
