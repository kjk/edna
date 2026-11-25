import { afterEach, describe, expect, it } from "vitest";
import { NoteLoader } from "../../src/editor/note-loader";
import { cleanup, createEditor, type TestEditor } from "./utils";

// races between note loads (docs/state-machines.md M5, issue 1)
describe("NoteLoader", () => {
  let te: TestEditor | undefined;

  afterEach(() => {
    cleanup(te);
    te = undefined;
  });

  const doc = (s: string) => "\n∞∞∞text\n" + s;

  function setup() {
    te = createEditor(doc("A"));
    const saved: [string, string][] = [];
    const pending = new Map<string, { resolve: (s: string) => void; reject: (e: Error) => void }>();
    const failures: string[] = [];
    const deleted = new Set<string>();
    let loader!: NoteLoader;
    // saves go to the note the loader says is current
    te.editor.saveCallback = async (content) => {
      saved.push([loader.current!, content]);
    };
    loader = new NoteLoader({
      editor: te.editor,
      loadNote: (name) => new Promise((resolve, reject) => pending.set(name, { resolve, reject })),
      noteExists: (name) => !deleted.has(name),
      willShow: () => {},
      loadFailed: (name) => failures.push(name),
      saveFailed: () => {},
      isDestroyed: () => false,
    });
    loader.current = "A";
    return { loader, saved, pending, failures, deleted, editor: te.editor };
  }

  function type(te: TestEditor, s: string) {
    const view = te.editor.view;
    view.dispatch({ changes: { from: view.state.doc.length, insert: s } });
  }

  it("later load wins when an earlier load finishes last", async () => {
    const { loader, pending, editor, saved } = setup();
    const pB = loader.load("B", true, () => {});
    const pC = loader.load("C", true, () => {});
    pending.get("C")!.resolve(doc("C"));
    expect(await pC).toBe("shown");
    pending.get("B")!.resolve(doc("B"));
    expect(await pB).toBe("superseded");
    expect(loader.current).toBe("C");
    expect(editor.getContent()).toBe(doc("C"));
    // edits are saved to C, not to B
    type(te!, "!");
    await editor.save();
    expect(saved).toEqual([["C", doc("C!")]]);
  });

  it("failed load keeps the previous note", async () => {
    const { loader, pending, editor, failures, saved } = setup();
    const p = loader.load("B", true, () => {});
    pending.get("B")!.reject(new Error("read error"));
    expect(await p).toBe("failed");
    expect(failures).toEqual(["B"]);
    expect(loader.current).toBe("A");
    type(te!, "!");
    await editor.save();
    expect(saved).toEqual([["A", doc("A!")]]);
  });

  it("edits typed while loading are saved to the previous note", async () => {
    const { loader, pending, editor, saved } = setup();
    const p = loader.load("B", true, () => {});
    type(te!, " typed");
    pending.get("B")!.resolve(doc("B"));
    await p;
    await Promise.resolve();
    expect(saved).toEqual([["A", doc("A typed")]]);
    expect(editor.getContent()).toBe(doc("B"));
  });

  it("saves edits to the old note while its previous write is still pending", async () => {
    const { loader, pending, editor, saved } = setup();
    const firstWrite = Promise.withResolvers<void>();
    editor.saveCallback = async (content) => {
      saved.push([loader.current!, content]);
      if (saved.length === 1) await firstWrite.promise;
    };
    const switching = loader.load("B", true, () => {});
    type(te!, " first");
    const saving = editor.save();
    pending.get("B")!.resolve(doc("B"));
    await Promise.resolve();
    type(te!, " second");
    firstWrite.resolve();

    await saving;
    expect(await switching).toBe("shown");
    expect(saved).toEqual([
      ["A", doc("A first")],
      ["A", doc("A first second")],
    ]);
    expect(editor.getContent()).toBe(doc("B"));
  });

  it("didShow is not called for a superseded load", async () => {
    const { loader, pending } = setup();
    const shown: string[] = [];
    const pB = loader.load("B", true, () => shown.push("B"));
    pending.get("B")!.resolve(doc("B"));
    await pB;
    // C starts before B's animation frame
    const pC = loader.load("C", true, () => shown.push("C"));
    pending.get("C")!.resolve(doc("C"));
    await pC;
    await expect.poll(() => shown).toEqual(["C"]);
  });

  it("reports the visible note if the next load fails before the frame", async () => {
    const { loader, pending, editor } = setup();
    const shown: string[] = [];
    const pB = loader.load("B", true, () => shown.push("B"));
    pending.get("B")!.resolve(doc("B"));
    expect(await pB).toBe("shown");

    const pC = loader.load("C", true, () => shown.push("C"));
    pending.get("C")!.reject(new Error("read error"));
    expect(await pC).toBe("failed");

    await expect.poll(() => shown).toEqual(["B"]);
    expect(loader.current).toBe("B");
    expect(editor.getContent()).toBe(doc("B"));
  });

  it("latest requested note wins even if an earlier request starts loading later", async () => {
    const { loader, pending, editor } = setup();
    const reqB = loader.newRequest();
    const reqC = loader.newRequest();
    // C reaches load() first (e.g. B's request was slower saving the current note)
    const pC = loader.load("C", true, () => {}, reqC);
    pending.get("C")!.resolve(doc("C"));
    expect(await pC).toBe("shown");
    expect(await loader.load("B", true, () => {}, reqB)).toBe("superseded");
    expect(editor.getContent()).toBe(doc("C"));
    expect(loader.current).toBe("C");
  });

  it("a note deleted while loading is not shown", async () => {
    const { loader, pending, editor, failures, deleted } = setup();
    const p = loader.load("B", true, () => {});
    deleted.add("B");
    pending.get("B")!.resolve(doc("B"));
    expect(await p).toBe("failed");
    expect(failures).toEqual(["B"]);
    expect(loader.current).toBe("A");
    expect(editor.getContent()).toBe(doc("A"));
  });
});
