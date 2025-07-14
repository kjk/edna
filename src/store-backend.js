export class BackendStore {
  async writeNoteMeta(m) {
    throw new Error("NYI");
  }
  async writeStringToFile(fileName, s) {
    throw new Error("NYI");
  }
  async readFileAsString(fileName) {
    throw new Error("NYI");
    return "";
  }
  async deleteNote(noteId) {
    throw new Error("NYI");
  }
  async createNote(noteId, name) {
    throw new Error("NYI");
  }
  async writeNoteContent(verId, content) {
    throw new Error("NYI");
  }
  async loadLatestNoteContent(noteId) {
    throw new Error("NYI");
    return "";
  }
}
