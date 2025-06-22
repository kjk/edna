import { SETTINGS_CHANGE_EVENT } from "@/src/common/constants";

class SettingsStore {
  settings = $state(window.heynote.settings);
  themeSetting = $state("system");
  theme = $state(window.heynote.themeMode.initial);

  onSettingsChange(settings) {
    this.settings = settings;
  }

  setTheme(theme) {
    window.heynote.themeMode.set(theme);
    this.themeSetting = theme;
  }

  setUp() {
    window.heynote.mainProcess.on(SETTINGS_CHANGE_EVENT, (event, settings) => {
      this.onSettingsChange(settings);
    });

    window.heynote.themeMode.get().then((mode) => {
      this.theme = mode.computed;
      this.themeSetting = mode.theme;
    });
    const onThemeChange = (theme) => {
      this.theme = theme;
      if (theme === "system") {
        document.documentElement.setAttribute(
          "theme",
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light",
        );
      } else {
        document.documentElement.setAttribute("theme", theme);
      }
    };
    onThemeChange(window.heynote.themeMode.initial);
    window.heynote.themeMode.onChange(onThemeChange);
  }

  tearDown() {
    window.heynote.themeMode.removeListener();
  }
}

let settingsStore = new SettingsStore();

export function useSettingsStore() {
  return settingsStore;
}
