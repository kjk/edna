import { ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { kSetContent, transactionsHasAnnotation } from "./annotation";
import type { MultiBlockEditor } from "./editor";

export function autoSaveContent(editor: MultiBlockEditor, interval: number) {
  return ViewPlugin.fromClass(
    class {
      private timer: number | undefined;
      private destroyed = false;

      private save = () => {
        this.timer = undefined;
        const generation = editor.contentGen;
        editor.save().catch((error: unknown) => {
          console.error("Failed to save note", error);
          if (!this.destroyed && generation === editor.contentGen && this.timer === undefined) {
            this.timer = window.setTimeout(this.save, interval);
          }
        });
      };

      scheduleIfDirty(): void {
        if (this.timer === undefined && editor.getContent() !== editor.diskContent) {
          this.timer = window.setTimeout(this.save, interval);
        }
      }

      update(update: ViewUpdate): void {
        if (!update.docChanged) {
          return;
        }
        window.clearTimeout(this.timer);
        this.timer = undefined;
        if (transactionsHasAnnotation(update.transactions, kSetContent)) {
          return;
        }
        const dirty = update.state.doc.toString() !== editor.diskContent;
        editor.setIsDirtyCallback(dirty);
        if (dirty) {
          this.timer = window.setTimeout(this.save, interval);
        }
      }

      destroy(): void {
        this.destroyed = true;
        window.clearTimeout(this.timer);
        this.save();
      }
    },
  );
}
