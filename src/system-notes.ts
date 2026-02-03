import { len, platformName } from "./util.js";

import dailyJournalRaw from "./notes/note-daily-journal.edna.txt?raw";
import { fixUpNoteContent } from "./notes.js";
import helpRaw from "./notes/note-help.edna.txt?raw";
import inboxRaw from "./notes/note-inbox.edna.txt?raw";
import scratchDevRaw from "./notes/note-scratch-dev.edna.txt?raw";
import scratchRaw from "./notes/note-scratch.edna.txt?raw";
import { fixUpShortcuts, keyHelpStr } from "./key-helper.js";
import releaseNotesRaw from "./notes/note-release-notes.edna.txt?raw";
import builtInFunctionsRaw from "./notes/note-built-in-functions.js?raw";
import myFunctionsRaw from "./notes/note-custom-functions.edna.txt?raw";

import { parseBuiltInFunctions } from "./functions.js";

/**
 * @returns {string}
 */
export function getHelp(platform = platformName) {
  let keyHelp = keyHelpStr(platform);
  let help = fixUpShortcuts(helpRaw, platform);
  help = help.replace("{{keyHelp}}", keyHelp);
  // links are for generated html under /help
  // when showing as note, it's just noise
  help = help.replaceAll("[Edna](https://edna.arslexis.io)", "Edna");
  return fixUpNoteContent(help);
}

export const blockHdrJavaScript = "\n∞∞∞javascript\n";

const blockHdrMarkdown = "\n∞∞∞markdown\n"; // avoid circular deps
let builtInHdr =
  blockHdrMarkdown +
  `# Edna bundled JavaScript function

Below are JavaScript functions included with Edna.

You can run them on current block content with "Run function with this block" command.

You can write your own functions.

To learn more see http://edna.arslexis.io/help#running-code
`;

/**
 * @returns {string}
 */
export function getBuiltInFunctionsNote() {
  let s = builtInFunctionsRaw;
  let parts = s.split("// ----------------------------");
  let res = [];
  for (let p of parts) {
    p = p.trim();
    if (len(p) === 0) {
      continue;
    }
    res.push(blockHdrJavaScript + p);
  }
  return builtInHdr + res.join("\n");
}

/**
 * @returns {string}
 */
export function getBuiltInFunctionsJS() {
  return builtInFunctionsRaw;
}

/**
 * @param {string} s
 * @returns {string}
 */
function fixUpNote(s) {
  s = fixUpNoteContent(s);
  s = fixUpShortcuts(s);
  let keyHelp = keyHelpStr(platformName);
  s = s.replace("{{keyHelp}}", keyHelp);
  return s;
}

/**
 * @returns {string}
 */
export function getReleaseNotes() {
  return fixUpNote(releaseNotesRaw);
}

/**
 * @returns {string}
 */
export function getInboxNote() {
  return fixUpNote(inboxRaw);
}

/**
 * @returns {string}
 */
export function getJournalNote() {
  return fixUpNote(dailyJournalRaw);
}

/**
 * @returns {string}
 */
export function getWelcomeNote() {
  return fixUpNote(scratchRaw);
}

/**
 * @returns {string}
 */
export function getWelcomeNoteDev() {
  return getWelcomeNote() + scratchDevRaw;
}

/**
 * @returns {string}
 */
export function getMyFunctionsNote() {
  return fixUpNote(myFunctionsRaw);
}

// this logically belongs in functions.js but I use bun test
// to test to test functions.js and it doesn't handle
// importing ?raw
/** @tye {BoopFunction[]} */
export let boopFunctions = [];

export function getBoopFunctions() {
  if (len(boopFunctions) === 0) {
    let jsRaw = getBuiltInFunctionsJS();
    boopFunctions = parseBuiltInFunctions(jsRaw);
  }
  return boopFunctions;
}
