import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import debounce from "debounce";
import { SET_CONTENT, transactionsHasAnnotation } from "./annotation";
import type { MultiBlockEditor } from "./editor";

export const autoSaveContent = (editor: MultiBlockEditor, interval: number) => {
  const debouncedSave = debounce(async () => {
    try {
      await editor.save();
      editor.setIsDirtyCallback(false);
    } catch (e) {
      console.error("autoSaveContent: save failed:", e);
    }
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
        editor.setIsDirtyCallback(true);
        debouncedSave();
      }

      destroy() {
        // save pending changes
        debouncedSave.flush();
      }
    },
  );
};
