import { isolateHistory } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { getActiveNoteBlock } from "./editor/block/block";
import type { MultiBlockEditor } from "./editor/editor";
import { getLanguage, langGetPrettierInfo } from "./editor/languages";

async function formatGo(source: string): Promise<string | null> {
  const response = await fetch("/api/goplay/fmt", { method: "POST", body: source });
  if (!response.ok) {
    return null;
  }
  const result = await response.json();
  return typeof result.Body === "string" && !result.Error ? result.Body : null;
}

export async function formatBlockContent(editor: MultiBlockEditor): Promise<boolean> {
  const { view, contentGen } = editor;
  const { state } = view;
  const block = getActiveNoteBlock(state);
  if (state.readOnly || !block || block.contentFrom === block.to) {
    return false;
  }
  const source = state.sliceDoc(block.contentFrom, block.to);
  const offset = Math.max(0, state.selection.main.head - block.contentFrom);
  let formatted: string | null;
  let cursor = offset;
  try {
    if (block.language === "golang") {
      formatted = await formatGo(source);
    } else {
      const config = await langGetPrettierInfo(getLanguage(block.language));
      if (!config) {
        return false;
      }
      const { formatWithCursor } = await import("prettier/standalone");
      const result = await formatWithCursor(source, {
        ...config,
        tabWidth: state.tabSize,
        useTabs: state.facet(indentUnit) === "\t",
        cursorOffset: offset,
      });
      formatted = result.formatted;
      cursor = result.cursorOffset;
    }
  } catch (error) {
    console.error("Failed to format block", error);
    return false;
  }
  if (formatted === null || state.doc !== view.state.doc || view.state.readOnly || editor.contentGen !== contentGen) {
    return false;
  }
  if (formatted === source) {
    return true;
  }
  if (offset === 0) {
    cursor = 0;
  } else if (offset === source.length) {
    cursor = formatted.length;
  }
  view.dispatch({
    changes: { from: block.contentFrom, to: block.to, insert: formatted },
    selection: { anchor: block.contentFrom + Math.min(formatted.length, Math.max(0, cursor)) },
    scrollIntoView: true,
    annotations: isolateHistory.of("full"),
    userEvent: "input.format",
  });
  return true;
}
