interface Window {
  heynote: {
    platform: {
      isMac: boolean;
      isWindows: boolean;
      isLinux: boolean;
      isWebApp: boolean;
    }
    defaultFontFamily: string;
    defaultFontSize: number;
    buffer: {
      async load(string): Promise<void>;
      async save(string, string): Promise<void>;
      // TODO: the type of cb chould be (content: any) => void
      addOnChangeCallback(string, cb: any): void;
      removeOnChangeCallback(string, cb: any): void;
    }
  }
}

