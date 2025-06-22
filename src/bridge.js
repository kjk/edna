let platform;

let __TESTS__ = false;

const isMobileDevice = window.matchMedia("(max-width: 600px)").matches;

// In the latest version of Playwright, the window.navigator.userAgentData.platform is not reported correctly on Mac,
// wo we'll fallback to deprecated window.navigator.platform which still works
if (__TESTS__ && window.navigator.platform.indexOf("Mac") !== -1) {
  platform = {
    isMac: true,
    isWindows: false,
    isLinux: false,
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
};

let ipcRenderer = null;

export { Heynote, ipcRenderer };
