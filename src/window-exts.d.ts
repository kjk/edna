interface GlobalThis {
  deubg: {
    listBrowserStorage: () => Promise<void>;
    deleteBrowserStorage: () => Promise<void>;
    resetApp: () => Promise<void>;
    dumpIndex: () => Promise<void>;
    testAppendStore: () => Promise<void>;
  };
}
