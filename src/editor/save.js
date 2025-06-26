import { ViewPlugin } from "@codemirror/view";
import debounce from "debounce";
import { appState } from "../state.svelte";
import { SET_CONTENT, transactionsHasAnnotation } from "./annotation";

export const autoSaveContent = (editor, interval) => {
  const debouncedSave = debounce(() => {
    editor.save();
    appState.isDirty = false;
  }, interval);

  return ViewPlugin.fromClass(
    class {
      update(update) {
        if (!update.docChanged) {
          return;
        }
        const isInitial = transactionsHasAnnotation(
          update.transactions,
          SET_CONTENT,
        );
        if (isInitial) {
          return;
        }
        appState.isDirty = true;
        debouncedSave();
      }
    },
  );
};
