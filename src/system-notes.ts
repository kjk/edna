import { len, platformName } from "./util";

import dailyJournalRaw from "./notes/note-daily-journal.elaris.txt?raw";
import { fixUpNoteContent } from "./notes";
import helpRaw from "./notes/note-help.elaris.txt?raw";
import inboxRaw from "./notes/note-inbox.elaris.txt?raw";
import scratchDevRaw from "./notes/note-scratch-dev.elaris.txt?raw";
import scratchRaw from "./notes/note-scratch.elaris.txt?raw";
import { fixUpShortcuts, keyHelpStr } from "./key-helper";
import releaseNotesRaw from "./notes/note-release-notes.elaris.txt?raw";
import builtInFunctionsRaw from "./notes/note-built-in-functions.js?raw";
import myFunctionsRaw from "./notes/note-custom-functions.elaris.txt?raw";

import { parseBuiltInFunctions } from "./functions";

export function getHelp(platform: string = platformName): string {
  let keyHelp = keyHelpStr(platform);
  let help = fixUpShortcuts(helpRaw, platform);
  help = help.replace("{{keyHelp}}", keyHelp);
  // links are for generated html under /help
  // when showing as note, it's just noise
  help = help.replaceAll("[Elaris](https://elaris.arslexis.io)", "Elaris");
  return fixUpNoteContent(help);
}

export const blockHdrJavaScript = "\n∞∞∞javascript\n";

const blockHdrMarkdown = "\n∞∞∞markdown\n"; // avoid circular deps
let builtInHdr =
  blockHdrMarkdown +
  `# Elaris bundled JavaScript function

Below are JavaScript functions included with Elaris.

You can run them on current block content with "Run function with this block" command.

You can write your own functions.

To learn more see http://elaris.arslexis.io/help#running-code
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

// this logically belongs in functions.js but I use bun test
// to test to test functions.js and it doesn't handle
// importing ?raw
export let boopFunctions: any[] = [];

export function getBoopFunctions(): any[] {
  if (len(boopFunctions) === 0) {
    let jsRaw = getBuiltInFunctionsJS();
    boopFunctions = parseBuiltInFunctions(jsRaw);
  }
  return boopFunctions;
}
