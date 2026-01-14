import { FileEntry } from "@zip.js/zip.js";
import { findNoteByName } from "./appstate.svelte";
import { modalInfoState } from "./components/ModalInfo.svelte";
import { fromFileName, isValidFileName } from "./filenamify";
import {
  createNoteWithUniqueName,
  loadNoteContent,
  maybeSaveNoteSelectionAndFoldedRanges,
  reassignNoteShortcut,
  saveNote,
  saveNoteMetadata,
} from "./notes";
import { len, throwIf, trimSuffix } from "./util";

export async function importEdnaNotesFromZipFile() {
  let opts = {
    types: [
      {
        description: "Edna export",
        accept: {
          "application/text": [".zip"],
        },
      },
    ],
    excludeAcceptAllOption: true,
  };
  let fileHandles;
  try {
    // @ts-ignore
    fileHandles = await window.showOpenFilePicker(opts);
  } catch (e) {
    console.log(e);
    return;
  }
  // read fileHandle as Blob
  let file = fileHandles[0];
  let blob = await file.getFile();

  console.warn("blob:", blob);
  let libZip = await import("@zip.js/zip.js");
  let zipReader = new libZip.ZipReader(new libZip.BlobReader(blob));
  let entries = await zipReader.getEntries();

  async function readMetadata() {
    for (let e of entries) {
      if (e.directory) {
        continue;
      }
      let ef = e as FileEntry;
      let name = ef.filename;
      if (name === "__metadata.edna.json") {
        let content = await ef.getData(new libZip.TextWriter());
        return JSON.parse(content);
      }
    }
    return { notes: [] };
  }
  let notesMeta = await readMetadata();
  console.warn("len(notesMeta.notes):", len(notesMeta.notes));
  function findNoteMeta(name: string) {
    for (let n of notesMeta.notes) {
      if (n.name === name) {
        return n;
      }
    }
    return null;
  }

  const kEdnaFileExt = ".edna.txt";
  const kEdnaEncrFileExt = ".encr.edna.txt";

  function trimEdnaExt(name: string): string {
    let s = trimSuffix(name, kEdnaEncrFileExt);
    s = trimSuffix(s, kEdnaFileExt);
    throwIf(s === name); // assumes we chacked before calling
    return s;
  }
  // returns null if not a valid name
  function noteNameFromFileNameFS(fileName: string): string {
    // throwIf(!isValidFileName(fileName));
    if (!isValidFileName(fileName)) {
      return null;
    }
    let encodedName = trimEdnaExt(fileName);
    let name = fromFileName(encodedName);
    return name.trim();
  }

  modalInfoState.clear();
  modalInfoState.title = "Importing notes";
  modalInfoState.canClose = false;
  let nImported = 0;
  for (let e of entries) {
    if (e.directory) {
      continue;
    }
    let ef = e as FileEntry;
    let fileName = ef.filename;
    if (!fileName.endsWith(".edna.txt")) {
      continue;
    }
    let name = noteNameFromFileNameFS(fileName);
    let msg = `Importing <b>${name}</b>`;
    modalInfoState.addMessage(msg);
    let content = await ef.getData(new libZip.TextWriter());
    let note = findNoteByName(name, true);
    if (note) {
      let existingContent = await loadNoteContent(name);
      if (existingContent === content) {
        modalInfoState.addMessage(`Skipping ${name}, already exists`);
        continue;
      }
    }
    nImported++;
    let realName = await createNoteWithUniqueName(name);
    await saveNote(realName, content);
    console.log(
      `${fileName} has size ${content.length}, realName: ${realName}`,
    );
    let m = findNoteMeta(name);
    if (!m) {
      continue;
    }
    note = findNoteByName(realName);
    let saveMeta = false;
    if (m.isArchived) {
      note.isArchived = true;
      saveMeta = true;
    }
    if (m.isStarred) {
      note.isStarred = true;
      saveMeta = true;
    }
    if (saveMeta) {
      await saveNoteMetadata(note);
    }
    if (m.altShortcut) {
      await reassignNoteShortcut(realName, m.altShortcut);
    }
    await maybeSaveNoteSelectionAndFoldedRanges(
      note,
      m.selection,
      m.foldedRanges,
    );
  }
  modalInfoState.addMessage(`Imported ${nImported} notes`);
  modalInfoState.canClose = true;
}
