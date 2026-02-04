import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import debounce from "debounce";
import { appState } from "../appstate.svelte";
import { SET_CONTENT, transactionsHasAnnotation } from "./annotation";
import type { EdnaEditor } from "./editor";

export const autoSaveContent = (editor: EdnaEditor, interval: number) => {
  const debouncedSave = debounce(() => {
    editor.save();
    appState.isDirty = false;
  }, interval);

  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.docChanged) {
          return;
        }
        const isInitial = transactionsHasAnnotation(update.transactions, SET_CONTENT);
        if (isInitial) {
          return;
        }
        appState.isDirty = true;
        debouncedSave();
      }
    },
  );
};
