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
      async getList(): Promise<any>; // TODO: it's a map of string to metadata
    }

    mainProcess: {
      on(event: string, cb: (...args: any[]) => void): void;
      off(event: string, cb: (...args: any[]) => void): void;
      invoke(event: string, ...args: any[]): Promise<any>;
    }

    // TODO: more concrete type
    settings: any;
    setSettings(settings: any): void;

    themeMode: {
      set(mode: string): void;
      async get(): Promise<{ theme: string, computed: string }>;
      onChange(cb: (theme: string, computed: string) => void): void;
      removeListener() : void;
      initial: string;
    }

    async getCurrencyData(): Promise<any>;
    async getVersion(): Promise<string>;
    async getInitErrors(): Promise<string[]>;
    setWindowTitle(title: string): void;
  }
}

