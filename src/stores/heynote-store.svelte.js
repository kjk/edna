import { SCRATCH_FILE_NAME } from "../common/constants";
import { NoteFormat } from "../common/note-format";

//import { useEditorCacheStore } from "./editor-cache";

class HeynoteStore {
  buffers = $state({});
  recentBufferPaths = $state([SCRATCH_FILE_NAME]);

  currentEditor = $state(null);
  currentBufferPath = $state(SCRATCH_FILE_NAME);
  currentBufferName = $state(null);
  currentLanguage = $state(null);
  currentLanguageAuto = $state(null);
  currentCursorLine = $state({ line: 0, col: 0, length: 0 });
  currentSelectionSize = $state(null);
  libraryId = $state(0);
  createBufferParams = $state({
    mode: "new",
    name: "",
  });

  showBufferSelector = $state(false);
  showLanguageSelector = $state(false);
  showCreateBuffer = $state(false);
  // showEditBuffer = $state(false);
  showMoveToBufferSelector = $state(false);
  showCommandPalette = $state(false);
  showBlockSelector = $state(false);
  showHistorySelector = $state(false);
  showFunctionSelector = $state(false);

  // provided by App.svelte
  realOpenCommandPalette;
  realOpenBlockSelector;
  realCreateScratchNote;
  realSmartRun;

  addRecentBuffer(path) {
    debugger;
    const recent = this.recentBufferPaths.filter((p) => p !== path);
    recent.unshift(path);
    this.recentBufferPaths = recent.slice(0, 100);
  }
  async updateBuffers() {
    debugger;
    this.setBuffers(await window.heynote.buffer.getList());
  }

  setBuffers(buffers) {
    debugger;
    this.buffers = buffers;
  }

  openBuffer(path) {
    debugger;
    this.closeDialog();
    this.currentBufferPath = path;
    this.addRecentBuffer(path);
  }

  openLanguageSelector() {
    this.closeDialog();
    this.showLanguageSelector = true;
  }

  openBufferSelector() {
    this.closeDialog();
    this.showBufferSelector = true;
  }

  openCommandPalette() {
    this.closeDialog();
    this.realOpenCommandPalette();
  }

  openHistorySelector() {
    this.closeDialog();
    this.showHistorySelector = true;
  }

  openBlockSelector() {
    this.closeDialog();
    this.realOpenBlockSelector();
  }

  openMoveToBufferSelector() {
    debugger;
    this.closeDialog();
    this.showMoveToBufferSelector = true;
  }

  openFunctionSelector() {
    this.closeDialog();
    this.showFunctionSelector = true;
  }

  openCreateBuffer(createMode, nameSuggestion) {
    createMode = createMode || "new";
    this.closeDialog();
    this.createBufferParams = {
      mode: createMode || "new",
      name: nameSuggestion || "",
    };
    this.showCreateBuffer = true;
  }

  closeDialog() {
    this.showCreateBuffer = false;
    this.showBufferSelector = false;
    this.showLanguageSelector = false;
    // this.showEditBuffer = false;
    this.showMoveToBufferSelector = false;
    this.showCommandPalette = false;
    this.showHistorySelector = false;
    this.showFunctionSelector = false;
  }

  closeBufferSelector() {
    this.showBufferSelector = false;
    this.showCommandPalette = false;
  }

  closeMoveToBufferSelector() {
    debugger;
    this.showMoveToBufferSelector = false;
  }

  // editBufferMetadata(path) {
  //   if (this.currentBufferPath !== path) {
  //     this.openBuffer(path);
  //   }
  //   this.closeDialog();
  //   this.showEditBuffer = true;
  // }

  createScratchNote() {
    this.realCreateScratchNote();
  }

  smartRun() {
    this.realSmartRun();
  }
}

/*
export const useHeynoteStore = defineStore("heynote", {
  actions: {

    executeCommand(command) {
      if (this.currentEditor) {
        toRaw(this.currentEditor).executeCommand(command);
      }
    },

    async createNewBufferFromActiveBlock(path, name) {
      await toRaw(this.currentEditor).createNewBufferFromActiveBlock(
        path,
        name,
      );
    },

    async createNewBuffer(path, name) {
      await toRaw(this.currentEditor).createNewBuffer(path, name);
    },

    async saveNewBuffer(path, name, content) {
      if (this.buffers[path]) {
        throw new Error(`Note already exists: ${path}`);
      }

      const note = new NoteFormat();
      note.content = content;
      note.metadata.name = name;
      //console.log("saving", path, note.serialize())
      await window.heynote.buffer.create(path, note.serialize());
      this.updateBuffers();
    },

    async updateBufferMetadata(path, name, newPath) {
      const editorCacheStore = useEditorCacheStore();

      if (this.currentEditor.path !== path) {
        throw new Error(
          `Can't update note (${path}) since it's not the active one (${this.currentEditor.path})`,
        );
      }
      //console.log("currentEditor", this.currentEditor)
      toRaw(this.currentEditor).setName(name);
      await toRaw(this.currentEditor).save();
      if (newPath && path !== newPath) {
        //console.log("moving note", path, newPath)
        editorCacheStore.freeEditor(path);
        await window.heynote.buffer.move(path, newPath);
        this.openBuffer(newPath);
        this.updateBuffers();
      }
    },

    async deleteBuffer(path) {
      if (path === SCRATCH_FILE_NAME) {
        throw new Error("Can't delete scratch file");
      }
      const editorCacheStore = useEditorCacheStore();
      if (this.currentEditor.path === path) {
        this.currentEditor = null;
        this.currentBufferPath = SCRATCH_FILE_NAME;
      }
      editorCacheStore.freeEditor(path);
      await window.heynote.buffer.delete(path);
      await this.updateBuffers();
    },

    async reloadLibrary() {
      const editorCacheStore = useEditorCacheStore();
      await this.updateBuffers();
      editorCacheStore.clearCache(false);
      this.currentEditor = null;
      this.currentBufferPath = SCRATCH_FILE_NAME;
      this.libraryId++;
    },
  },
});
*/

let store = new HeynoteStore();
export function useHeynoteStore() {
  return store;
}

export async function initHeynoteStore() {
  const heynoteStore = useHeynoteStore();
  // window.heynote.buffer.setLibraryPathChangeCallback(() => {
  //   heynoteStore.reloadLibrary();
  // });
  // await heynoteStore.updateBuffers();
}
