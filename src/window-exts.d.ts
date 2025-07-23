interface GlobalThis {
  __WB_MANIFEST: any;
  math: any;
  deubg: {
    listBrowserStorage: () => Promise<void>;
    deleteBrowserStorage: () => Promise<void>;
    resetApp: () => Promise<void>;
    dumpIndex: () => Promise<void>;
    testAppendStore: () => Promise<void>;
  };
}

interface Window {
  __WB_MANIFEST: any;
}
