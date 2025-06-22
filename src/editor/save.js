import { ViewPlugin } from "@codemirror/view"
import debounce from "debounce"
import { appState } from "../state.svelte"

export const autoSaveContent = (editor, interval) => {
  const save = debounce((view) => {
    //console.log("saving buffer")
    editor.save();
    appState.isDirty = false;
  }, interval);

  const debouncedClearDirtyFast = debounce(() => {
    appState.isDirtyFast = false;
  }, 500);

  return ViewPlugin.fromClass(
    class {
      update(update) {
        if (update.docChanged) {
          appState.isDirty = true;
          appState.isDirtyFast = true;
          save();
          debouncedClearDirtyFast();
        }
      }
    },
  );
};
