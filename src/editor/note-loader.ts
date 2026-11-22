import type { MultiBlockEditor } from "./editor";

// Loads notes into the editor, keeping invariants O-I1..O-I3 from
// docs/state-machines.md (M5):
// - `current` (the note saves go to) changes only together with setContent()
// - only the most recently requested load is applied
// - a failed load leaves the editor on the previous note

export type LoadResult = "shown" | "superseded" | "failed";

export interface NoteLoaderOptions {
  editor: MultiBlockEditor;
  loadNote: (name: string) => Promise<string | undefined>;
  // called right before the editor content is replaced with note `name`
  willShow: (name: string) => void;
  loadFailed: (name: string, err: unknown) => void;
  saveFailed: (name: string, err: unknown) => void;
  isDestroyed: () => boolean;
}

export class NoteLoader {
  // note whose content is in the editor; saves go to this note
  current: string | undefined;
  private gen = 0;

  constructor(private opts: NoteLoaderOptions) {}

  /**
   * Starts a request to show a note. Call before any awaits done on behalf of
   * the request (e.g. saving the current note) and pass the result to load():
   * the latest *requested* note wins, even if an earlier request reaches
   * load() later.
   */
  newRequest(): number {
    return ++this.gen;
  }

  /**
   * Loads note `name` into the editor. didShow() is called in the next
   * animation frame unless another load was requested in the meantime.
   * If saveCurrent, edits made to the current note while loading are saved
   * to the current note before switching.
   */
  async load(name: string, saveCurrent: boolean, didShow: () => void, request?: number): Promise<LoadResult> {
    const { editor } = this.opts;
    const gen = request ?? ++this.gen;
    if (gen !== this.gen) {
      return "superseded";
    }
    let content: string;
    try {
      content = (await this.opts.loadNote(name)) || "";
    } catch (e) {
      if (gen === this.gen && !this.opts.isDestroyed()) {
        this.opts.loadFailed(name, e);
      }
      return "failed";
    }
    if (gen !== this.gen || this.opts.isDestroyed()) {
      return "superseded";
    }
    const prev = this.current;
    if (saveCurrent && prev !== undefined) {
      // note: save() captures the note it saves to synchronously, before we switch
      editor.save().catch((e) => this.opts.saveFailed(prev, e));
    }
    this.opts.willShow(name);
    this.current = name;
    editor.setContent(content);
    // Use requestAnimationFrame to avoid race condition with scrollIntoView
    requestAnimationFrame(() => {
      if (gen !== this.gen || this.opts.isDestroyed()) {
        return;
      }
      didShow();
    });
    return "shown";
  }
}
