import { expect, it } from "vitest";
import { blockHdrMarkdown } from "../../src/constants";
import { fsReadTextFile, fsWriteFile } from "../../src/fileutil";
import { appendToNote, createNoteWithName } from "../../src/notes";
import { setupFSStorage } from "./fs-utils";

// a note created outside this tab (another tab, a sync tool) isn't in the
// in-memory list yet; it must not be overwritten (docs/state-machines.md U30)
it("creating / appending to a note not in the in-memory list doesn't overwrite it", async () => {
  const { dh } = await setupFSStorage();
  await fsWriteFile(dh, "ext.edna.txt", blockHdrMarkdown + "from elsewhere");
  await expect(createNoteWithName("ext", blockHdrMarkdown + "mine")).rejects.toThrow("already exists");
  expect(await fsReadTextFile(dh, "ext.edna.txt")).toBe(blockHdrMarkdown + "from elsewhere");

  await fsWriteFile(dh, "ext2.edna.txt", blockHdrMarkdown + "from elsewhere");
  await appendToNote("ext2", blockHdrMarkdown + "appended");
  expect(await fsReadTextFile(dh, "ext2.edna.txt")).toBe(blockHdrMarkdown + "from elsewhere" + blockHdrMarkdown + "appended");
});
