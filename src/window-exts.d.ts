interface GlobalThis {
  math: any;
  deubg: {
    listBrowserStorage: () => Promise<void>;
    deleteBrowserStorage: () => Promise<void>;
    resetApp: () => Promise<void>;
    dumpIndex: () => Promise<void>;
    testAppendStore: () => Promise<void>;
  };
}
