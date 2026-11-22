import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { flowchartTags, mermaidTags } from "codemirror-lang-mermaid";

export const darkTheme = EditorView.theme(
  {
    "&": {
      color: "#d8dee9",
      colorScheme: "dark",
      backgroundColor: "#252b37",
      "--edna-panel": "#2e3440",
      "--edna-block-even": "#252b37",
      "--edna-block-odd": "#213644",
      "--edna-divider": "#151b25",
      "--edna-link": "#89b9d5",
      "--edna-result-text": "#a0e7c7",
      "--edna-result-background": "#0e1217",
      "--edna-fold-marker": "#d8dee9aa",
      "--edna-fold-background": "#ffffff12",
      "--edna-fold-text": "#d8dee9",
    },
    ".cm-gutters": { backgroundColor: "#0000001a", color: "#ffffff26", border: "0" },
    ".cm-activeLine": { backgroundColor: "#ffffff0a" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#d8dee9b0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#eceff4" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "#445973" },
    ".cm-content ::selection": { backgroundColor: "#445973" },
    ".cm-searchMatch": { backgroundColor: "#656043" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "#806e3c" },
  },
  { dark: true },
);

export const darkHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.modifier, tags.definitionKeyword, mermaidTags.diagramName, flowchartTags.diagramName],
    color: "#81a1c1",
  },
  { tag: [tags.number, tags.bool, tags.atom, tags.null], color: "#b48ead" },
  { tag: [tags.operator, tags.string, tags.regexp], color: "#a3be8c" },
  { tag: [tags.comment, tags.meta], color: "#8592aa", fontStyle: "italic" },
  { tag: [tags.variableName, tags.propertyName, tags.function(tags.variableName), tags.tagName], color: "#8fbcbb" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#8fbcbb" },
  { tag: [tags.attributeName, tags.escape], color: "#ebcb8b" },
  { tag: [tags.heading, tags.strong], fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: [tags.link, tags.url], color: "#89b9d5", textDecoration: "underline" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.invalid, color: "#e48b93" },
]);

export const heynoteDark = [
  EditorView.editorAttributes.of({ class: "dark-theme" }),
  darkTheme,
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  syntaxHighlighting(darkHighlightStyle),
];
