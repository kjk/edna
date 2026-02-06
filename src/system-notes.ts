// this logically belongs in functions.js but I use bun test
// to test to test functions.js and it doesn't handle
// importing ?raw
import { blockHdrJavaScript, blockHdrMarkdown } from "./constants";
import type { BoopFunction } from "./functions";
import { parseBuiltInFunctions } from "./functions.js";
import { fixUpShortcuts, keyHelpStr } from "./key-helper.js";
import { fixUpNoteContent } from "./notes.js";
// @ts-ignore
import builtInFunctionsRaw from "./notes/note-built-in-functions.js?raw";
// @ts-ignore
import myFunctionsRaw from "./notes/note-custom-functions.edna.txt?raw";
// @ts-ignore
import dailyJournalRaw from "./notes/note-daily-journal.edna.txt?raw";
// @ts-ignore
import helpRaw from "./notes/note-help.edna.txt?raw";
// @ts-ignore
import inboxRaw from "./notes/note-inbox.edna.txt?raw";
// @ts-ignore
import releaseNotesRaw from "./notes/note-release-notes.edna.txt?raw";
// @ts-ignore
import scratchDevRaw from "./notes/note-scratch-dev.edna.txt?raw";
// @ts-ignore
import scratchRaw from "./notes/note-scratch.edna.txt?raw";
import { len, platformName } from "./util.js";

export function getHelp(platform = platformName): string {
  let keyHelp = keyHelpStr(platform);
  let help = fixUpShortcuts(helpRaw, platform);
  help = help.replace("{{keyHelp}}", keyHelp);
  // links are for generated html under /help
  // when showing as note, it's just noise
  help = help.replaceAll("[Edna](https://edna.arslexis.io)", "Edna");
  return fixUpNoteContent(help);
}

let builtInHdr =
  blockHdrMarkdown +
  `# Edna bundled JavaScript function

Below are JavaScript functions included with Edna.

You can run them on current block content with "Run function with this block" command.

You can write your own functions.

To learn more see http://edna.arslexis.io/help#running-code
`;

export function getBuiltInFunctionsNote(): string {
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

export function getBuiltInFunctionsJS(): string {
  return builtInFunctionsRaw;
}

function fixUpNote(s: string): string {
  s = fixUpNoteContent(s);
  s = fixUpShortcuts(s);
  let keyHelp = keyHelpStr(platformName);
  s = s.replace("{{keyHelp}}", keyHelp);
  return s;
}

export function getReleaseNotes(): string {
  return fixUpNote(releaseNotesRaw);
}

export function getInboxNote(): string {
  return fixUpNote(inboxRaw);
}

export function getJournalNote(): string {
  return fixUpNote(dailyJournalRaw);
}

export function getWelcomeNote(): string {
  return fixUpNote(scratchRaw);
}

export function getWelcomeNoteDev(): string {
  return getWelcomeNote() + scratchDevRaw;
}

export function getMyFunctionsNote(): string {
  return fixUpNote(myFunctionsRaw);
}

export let boopFunctions: BoopFunction[] = [];

export function getBoopFunctions() {
  if (len(boopFunctions) === 0) {
    let jsRaw = getBuiltInFunctionsJS();
    boopFunctions = parseBuiltInFunctions(jsRaw);
  }
  return boopFunctions;
}
