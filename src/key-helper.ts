import { arrayRemoveAt, getAltChar, getModChar, platformName, throwIf } from "./util.js";

// replace Alt and Mod with platform-specific key names
export function fixUpShortcuts(s: string, platform = platformName): string {
  let modChar = getModChar(platform);
  let altChar = getAltChar(platform);
  s = s.replace(/\bAlt\b/g, altChar);
  s = s.replace(/\bMod\b/g, modChar);
  return s;
}

// like fixUpShortcuts() but only inside `code` spans of markdown
export function fixUpShortcutsInCode(s: string, platform = platformName): string {
  return s.replace(/`([^`]*)`/g, (match, code) => "`" + fixUpShortcuts(code, platform) + "`");
}

function getKeyHelp(platform = platformName): string[][] {
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

    [`Mod + Shift + [`, "Fold code"],
    [`Mod + Shift + ]`, "Unfold code"],
    [`Mod + Alt + [`, "Fold block"],
    [`Mod + Alt + ]`, "Unfold block"],
    [`Mod + Alt + .`, "Toggle block fold"],

    [`Mod + A`, "Select all text in a note block"],
    [``, "Press again to select the whole buffer"],
    [`Mod + Alt + Up/Down`, "Add additional cursor above/below"],
    [`Mod + Shift + Space`, "Toggle todo checkbox in markdown block"],
    [`Alt + Shift + F`, "Format block content"],
    [``, "Supports Go, JSON, JavaScript, HTML, CSS and Markdown"],
    [`Mod + E`, "Smart Code Run"],
    [``, "Supports Go"],
    [`Alt + Shift + R`, "Run function with block content"],
    [`Mod + F`, "Search / replace within a note"],
    [`Mod + Shift + F`, "Search in all notes"],
  ];
  // remove Alt + N for mac
  if (isMac) {
    let altNIdx = res.findIndex((el) => el[0] === "Alt + N");
    throwIf(altNIdx < 0, "Could not find Alt + N in key help");
    arrayRemoveAt(res, altNIdx);
  }
  for (let el of res) {
    el[0] = fixUpShortcuts(el[0], platform);
    el[1] = fixUpShortcuts(el[1], platform);
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

// fix up Alt / Mod shortcuts in a note and replace {{keyHelp}} with the keyboard shortcuts table
// forHTML: only fix up `code` spans and put the table in a code block (for generated help html)
export function expandKeyHelp(s: string, platform = platformName, forHTML = false): string {
  let keyHelp = keyHelpStr(platform);
  if (forHTML) {
    keyHelp = "```\n" + keyHelp + "\n```";
  }
  s = forHTML ? fixUpShortcutsInCode(s, platform) : fixUpShortcuts(s, platform);
  return s.replace("{{keyHelp}}", keyHelp);
}
