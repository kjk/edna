import { describe, expect, it } from "vitest";
import { fsReadTextFile } from "../../src/fileutil";
import { kMetadataName, saveNotesMetadata } from "../../src/metadata";
import { isMoving } from "../../src/mouse-track.svelte";
import { setupFSStorage } from "./fs-utils";

// issue 14 in docs/state-machines.md
describe("low impact fixes", () => {
  it("closing a dialog doesn't re-enable mouse tracking while find panel is open", () => {
    isMoving.findPanelOpen = true;
    isMoving.dialogOpen = true;
    isMoving.dialogOpen = false;
    expect(isMoving.disableMoveTracking).toBe(true);
    isMoving.findPanelOpen = false;
    expect(isMoving.disableMoveTracking).toBe(false);
  });

  it("metadata writes complete in order", async () => {
    const { dh } = await setupFSStorage();
    const writes = [];
    for (let i = 0; i < 10; i++) {
      writes.push(saveNotesMetadata({ ver: 1, notes: [{ name: `n${i}` }], functions: [] }));
    }
    await Promise.all(writes);
    const m = JSON.parse(await fsReadTextFile(dh, kMetadataName));
    expect(m.notes[0].name).toBe("n9");
  });
});
