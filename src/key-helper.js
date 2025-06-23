import { getAltChar, getModChar, platformName } from "./util.js";

export function fixUpShortcuts(s, platform = platformName) {
  let modChar = getModChar(platform);
  let altChar = getAltChar(platform);
  s = s.replace(/Alt/g, altChar);
  s = s.replace(/Mod/g, modChar);
  return s;
}

function getKeyHelp(platform = platformName) {
  const modChar = getModChar(platform);
  const altChar = getAltChar(platform);
  let res = [
    [`Mod + P`, "Open, create or delete a note"],
    [`Mod + K`, ``],
    [`Mod + O`, ``],
    [`Alt + 0`, ``],
    [``, ``],
    [`Mod + Shift + P`, "Command Palette"],
    [`Mod + Shift + K`, ``],
    [`Mod + Shift + O`, ``],
    [``, ``],
    [`Mod + B`, "Navigate to a block"],
    [`Mod + H`, "Open recent note (from history)"],
    [`Alt + N`, "Create a new scratch note"],
    [`Mod + Enter`, "Add new block below the current block"],
    [`Alt + Enter`, "Add new block before the current block"],
    [`Mod + Shift + Enter`, "Add new block at the end of the buffer"],
    [`Alt + Shift + Enter`, "Add new block at the start of the buffer"],
    [`Mod + Alt + Enter`, "Split the current block at cursor position"],
    [`Mod + L`, "Change block language"],
    [`Mod + Down`, "Goto next block"],
    [`Mod + Up`, "Goto previous block"],
    [`Mod + A`, "Select all text in a note block"],
    [``, "Press again to select the whole buffer"],
    [`Mod + Alt + Up/Down`, "Add additional cursor above/below"],
    [`Alt + Shift + F`, "Format block content"],
    [``, "Supports Go, JSON, JavaScript, HTML, CSS and Markdown"],
    [`Mod + E`, "Smart Code Run"],
    [`Alt + Shift + R`, "Run function with block content"],
    [``, "Supports Go"],
    [`Mod + F`, "Search / replace within a note"],
  ];
  for (let el of res) {
    el[0] = el[0].replaceAll("Mod", modChar);
    el[1] = el[1].replaceAll("Mod", modChar);
    el[0] = el[0].replaceAll("Alt", altChar);
    el[1] = el[1].replaceAll("Alt", altChar);
  }
  return res;
}

/**
 * @param {string} platform
 * @returns {string}
 */
export function keyHelpStr(platform = platformName) {
  const keyHelp = getKeyHelp(platform);
  const keyMaxLength = keyHelp
    .map(([key]) => key.length)
    .reduce((a, b) => Math.max(a, b));

  return keyHelp
    .map(([key, help]) => `${key.padEnd(keyMaxLength)}   ${help}`)
    .join("\n");
}
