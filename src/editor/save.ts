import { ViewPlugin, ViewUpdate } from "@codemirror/view";
import debounce from "debounce";
import { SET_CONTENT, transactionsHasAnnotation } from "./annotation";
import type { EdnaEditor } from "./editor";

export const autoSaveContent = (editor: EdnaEditor, setIsDirty: (dirty: boolean) => void, interval: number) => {
  const debouncedSave = debounce(() => {
    editor.save();
    setIsDirty(false);
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
        setIsDirty(true);
        debouncedSave();
      }
    },
  );
};
