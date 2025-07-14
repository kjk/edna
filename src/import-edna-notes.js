import { findNoteByName } from "./appstate.svelte";
import {
  clearModalMessage,
  showModalMessageHTML,
} from "./components/ModalMessage.svelte";
import { fromFileName, isValidFileName } from "./filenamify";
import {
  createNoteWithUniqueName,
  maybeSaveNoteSelectionAndFoldedRanges,
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
  let blobReader = new libZip.BlobReader(blob);
  let zipReader = new libZip.ZipReader(blobReader);
  let entries = await zipReader.getEntries();

  async function readMetadata() {
    for (let e of entries) {
      let name = e.filename;
      if (name === "__metadata.edna.json") {
        // TODO: read metadata
        let textWriter = new libZip.TextWriter();
        await e.getData(textWriter);
        let content = await textWriter.getData();
        return JSON.parse(content);
      }
    }
    return { notes: [] };
  }
  let notesMeta = await readMetadata();
  console.warn("len(notesMeta.notes):", len(notesMeta.notes));
  function findNoteMeta(name) {
    for (let n of notesMeta.notes) {
      if (n.name === name) {
        return n;
      }
    }
    return null;
  }

  const kEdnaFileExt = ".edna.txt";
  const kEdnaEncrFileExt = ".encr.edna.txt";

  /**
   * @param {string} name
   * @returns {string}
   */
  function trimEdnaExt(name) {
    let s = trimSuffix(name, kEdnaEncrFileExt);
    s = trimSuffix(s, kEdnaFileExt);
    throwIf(s === name); // assumes we chacked before calling
    return s;
  }
  /**
   * returns null if not a valid name
   * @param {string} fileName
   * @returns {string}
   */
  function noteNameFromFileNameFS(fileName) {
    // throwIf(!isValidFileName(fileName));
    if (!isValidFileName(fileName)) {
      return null;
    }
    let encodedName = trimEdnaExt(fileName);
    let name = fromFileName(encodedName);
    return name;
  }

  for (let e of entries) {
    let fileName = e.filename;
    if (!fileName.endsWith(".edna.txt")) {
      continue;
    }
    let name = noteNameFromFileNameFS(fileName);
    let msg = `Importing <b>${name}</b>`;
    showModalMessageHTML(msg, 0);
    let textWriter = new libZip.TextWriter();
    await e.getData(textWriter);
    let content = await textWriter.getData();
    let realName = await createNoteWithUniqueName(name);
    await saveNote(realName, content);
    console.log(
      `${fileName} has size ${content.length}, realName: ${realName}`,
    );
    let m = findNoteMeta(name);
    if (!m) {
      continue;
    }
    let note = findNoteByName(realName);
    let saveMeta = false;
    if (m.isArchived) {
      note.isArchived = true;
      saveMeta = true;
    }
    if (m.isStarred) {
      note.isStarred = true;
      saveMeta = true;
    }
    if (m.altShortcut) {
      note.altShortcut = m.altShortcut;
      saveMeta = true;
    }
    if (saveMeta) {
      await saveNoteMetadata(note);
    }
    await maybeSaveNoteSelectionAndFoldedRanges(
      note,
      m.selection,
      m.foldedRanges,
    );
  }
  clearModalMessage();
}
