import { loadNote, saveNote } from "./notes";

let __TESTS__ = false;

const isMobileDevice = window.matchMedia("(max-width: 600px)").matches;

let currencyData = null;

let platform;

// In the latest version of Playwright, the window.navigator.userAgentData.platform is not reported correctly on Mac,
// wo we'll fallback to deprecated window.navigator.platform which still works
if (__TESTS__ && window.navigator.platform.indexOf("Mac") !== -1) {
  platform = {
    isMac: true,
    isWindows: false,
    isLinux: false,
    isWebApp: true,
  };
} else {
  const uaPlatform =
    window.navigator?.userAgentData?.platform || window.navigator.platform;
  if (uaPlatform.indexOf("Win") !== -1) {
    platform = {
      isMac: false,
      isWindows: true,
      isLinux: false,
    };
  } else if (uaPlatform.indexOf("Linux") !== -1) {
    platform = {
      isMac: false,
      isWindows: false,
      isLinux: true,
    };
  } else {
    platform = {
      isMac: true,
      isWindows: false,
      isLinux: false,
    };
  }
}
platform.isWebApp = true;

const Heynote = {
  platform: platform,
  defaultFontFamily: "Hack",
  defaultFontSize: isMobileDevice ? 16 : 12,

  buffer: {
    async load(path) {
      console.log("Heynote.buffer.load:", path);
      let content = await loadNote(path);
      return content === null
        ? '{"formatVersion":"1.0.0","name":"Scratch"}\n∞∞∞text-a\n'
        : content;
    },

    async save(path, content) {
      console.log(`Heynote.buffer.save: '${path}, ${content.length} bytes`);
      await saveNote(path, content);
      // TODO: is disabled anyway
      // scheduleRefreshFromDisk();
    },

    async create(path, content) {
      // localStorage.setItem(noteKey(path), content);
    },

    async delete(path) {
      // localStorage.removeItem(noteKey(path));
    },

    async move(path, newPath) {
      // const content = localStorage.getItem(noteKey(path));
      // localStorage.setItem(noteKey(newPath), content);
      // localStorage.removeItem(noteKey(path));
    },

    async saveAndQuit(contents) {},

    async exists(path) {
      // return localStorage.getItem(noteKey(path)) !== null;
    },
  },

  async getList() {
    //return {"scratch.txt": {name:"Scratch"}}
    const notes = {};
    // for (let [key, content] of Object.entries(localStorage)) {
    //   if (key.startsWith(NOTE_KEY_PREFIX)) {
    //     const path = key.slice(NOTE_KEY_PREFIX.length);
    //     notes[path] = getNoteMetadata(content);
    //   }
    // }
    return notes;
  },

  async getDirectoryList() {
    const directories = new Set();
    // for (let key in localStorage) {
    //   if (key.startsWith(NOTE_KEY_PREFIX)) {
    //     const path = key.slice(NOTE_KEY_PREFIX.length);
    //     const parts = path.split("/");
    //     if (parts.length > 1) {
    //       for (let i = 1; i < parts.length; i++) {
    //         directories.add(parts.slice(0, i).join("/"));
    //       }
    //     }
    //   }
    // }
    //console.log("directories", directories)
    return [...directories];
  },

  async close(path) {},

  _onChangeCallbacks: {},
  addOnChangeCallback(path, callback) {},
  removeOnChangeCallback(path, callback) {},

  getCurrencyData: async () => {
    if (currencyData !== null) {
      return currencyData;
    }
    const response = await fetch("/api/currency_rates.json", {
      cache: "no-cache",
    });
    currencyData = JSON.parse(await response.text());
    return currencyData;
  },

  async getVersion() {
    // __APP_VERSION__ and __GIT_HASH__ are set in vite.config.js
    // @ts-ignore
    return __APP_VERSION__ + " (" + __GIT_HASH__ + ")";
  },

  async getInitErrors() {},

  setWindowTitle(title) {
    document.title = title + " - Heynote";
  },
};

let ipcRenderer = null;

export { Heynote, ipcRenderer };
