import { ViewPlugin } from "@codemirror/view";
import debounce from "debounce";
import { useHeynoteStore } from "../stores/heynote-store.svelte";

let notesStore = useHeynoteStore();

export const autoSaveContent = (editor, interval) => {
  const save = debounce((view) => {
    //console.log("saving buffer")
    editor.save();
    notesStore.isDirty = false;
  }, interval);

  const debouncedClearDirtyFast = debounce(() => {
    notesStore.isDirtyFast = false;
  }, 500);

  return ViewPlugin.fromClass(
    class {
      update(update) {
        if (update.docChanged) {
          notesStore.isDirty = true;
          notesStore.isDirtyFast = true;
          save();
          debouncedClearDirtyFast();
        }
      }
    },
  );
};
