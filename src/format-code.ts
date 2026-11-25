import { isolateHistory } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { blockContentText, getEditableActiveBlock, replaceBlockContent } from "./editor/block/block";
import type { MultiBlockEditor } from "./editor/editor";
import { getLanguage } from "./editor/languages";

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
  const block = getEditableActiveBlock(state);
  if (!block || block.contentFrom === block.to) {
    return false;
  }
  const fileType = getLanguage(block.language)?.formatType;
  if (!fileType) {
    return false;
  }
  const source = blockContentText(state, block);
  const offset = Math.max(0, state.selection.main.head - block.contentFrom);
  let formatted: string | null;
  try {
    if (fileType === "go") {
      formatted = await formatGo(source);
    } else {
      const params = new URLSearchParams({
        type: fileType,
        tabWidth: String(state.tabSize),
        useTabs: String(state.facet(indentUnit) === "\t"),
      });
      const response = await fetch(`/api/format?${params}`, { method: "POST", body: source });
      formatted = response.ok ? await response.text() : null;
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
  const cursor = offset === source.length ? formatted.length : Math.min(offset, formatted.length);
  replaceBlockContent(view, block, formatted, cursor, {
    annotations: isolateHistory.of("full"),
    userEvent: "input.format",
  });
  return true;
}
