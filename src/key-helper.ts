import { getAltChar, getModChar, platformName } from "./util.js";

export function fixUpShortcuts(s: string, platform = platformName): string {
  let modChar = getModChar(platform);
  let altChar = getAltChar(platform);
  s = s.replace(/Alt/g, altChar);
  s = s.replace(/Mod/g, modChar);
  return s;
}

function getKeyHelp(platform = platformName): string[][] {
  const modChar = getModChar(platform);
  const altChar = getAltChar(platform);
  let isMac = platform === "darwin";
  let res = [
    [`Mod + K`, "Open, create or delete a note"],
    [`Mod + P`, ``],
    [`Mod + O`, ``],
    [`Mod + H`, "Open recent note (from history)"],
    [`Mod + Shift + P`, "Command Palette"],
    [`Mod + Shift + K`, ``],
    [`Mod + Shift + O`, ``],
    [`Mod + L`, "Change block language"],
    [`Mod + B`, "Navigate to a block"],
    [`Alt + N`, "Create a new scratch note"],
    [`Mod + Enter`, "Add new block below the current block"],
    [`Alt + Enter`, "Add new block before the current block"],
    [`Mod + Shift + Enter`, "Add new block at the end of the buffer"],
    [`Alt + Shift + Enter`, "Add new block at the start of the buffer"],
    [`Mod + Alt + Enter`, "Split the current block at cursor position"],
    [`Mod + Down`, "Goto next block"],
    [`Mod + Up`, "Goto previous block"],

    ["Ctrl + Shift + [", "Fold code"],
    ["Ctrl + Shift + ]", "Unfold code"],
    ["Ctrl + Alt + [", "Fold block"],
    ["Ctrl + Alt + ]", "Unfold block"],
    ["Ctrl + Alt + .", "Toggle block fold"],

    [`Mod + A`, "Select all text in a note block"],
    [``, "Press again to select the whole buffer"],
    [`Mod + Alt + Up/Down`, "Add additional cursor above/below"],
    [`Alt + Shift + F`, "Format block content"],
    [``, "Supports Go, JSON, JavaScript, HTML, CSS and Markdown"],
    [`Mod + E`, "Smart Code Run"],
    [`Alt + Shift + R`, "Run function with block content"],
    [``, "Supports Go"],
    [`Mod + F`, "Search / replace within a note"],
    [`Mod + Shift + F`, "Search in all notes"],
  ];
  // remove Alt + N for mac
  if (isMac) {
    function removeAltN() {
      for (let i = 0; i < res.length; i++) {
        if (res[i][0] === "Alt + N") {
          res.splice(i, 1);
          return;
        }
      }
      throw new Error("Could not find Alt + N in key help");
    }
    removeAltN();

    function updateMacKeyBindings() {
      // replace Ctrl with Mod
      let changes = [
        "Ctrl + Shift + [",
        "Ctrl + Shift + ]",
        "Ctrl + Alt + [",
        "Ctrl + Alt + ]",
        "Ctrl + Alt + .",
      ];
      for (let i = 0; i < res.length; i++) {
        let key = res[i][0];
        if (changes.includes(key)) {
          res[i][0] = key.replace("Ctrl", "Mod");
        }
      }
    }
    updateMacKeyBindings();
  }
  for (let el of res) {
    el[0] = el[0].replaceAll("Mod", modChar);
    el[1] = el[1].replaceAll("Mod", modChar);
    el[0] = el[0].replaceAll("Alt", altChar);
    el[1] = el[1].replaceAll("Alt", altChar);
  }
  return res;
}

export function keyHelpStr(platform = platformName): string {
  const keyHelp = getKeyHelp(platform);
  const keyMaxLength = keyHelp
    .map(([key]) => key.length)
    .reduce((a, b) => Math.max(a, b));

  return keyHelp
    .map(([key, help]) => `${key.padEnd(keyMaxLength)}   ${help}`)
    .join("\n");
}
