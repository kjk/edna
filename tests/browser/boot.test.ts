import { describe, expect, it } from "vitest";
import { dbDelDirHandle, dbSetDirHandle } from "../../src/notes";
import { bootApp } from "./app-ui";

// boot with a notes directory that can't be read (docs/state-machines.md M1, issue 8)
describe("boot", () => {
  it("shows a recovery screen if the notes directory can't be read", async () => {
    localStorage.clear();
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("deleted-notes-dir", { create: true });
    await dbSetDirHandle(dir);
    await root.removeEntry("deleted-notes-dir", { recursive: true });

    const div = await bootApp();
    await expect.poll(() => div.textContent, { timeout: 5000 }).toContain("Failed to read notes in that directory");
    expect(div.textContent).toContain("Switch to storing notes in browser");
    await dbDelDirHandle();
  });
});
