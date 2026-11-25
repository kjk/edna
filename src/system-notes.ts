// this logically belongs in functions.js but I use bun test
// to test to test functions.js and it doesn't handle
// importing ?raw
import {
  blockHdrJavaScript,
  blockHdrMarkdown,
  kBuiltInFunctionsNoteName,
  kHelpSystemNoteName,
  kReleaseNotesSystemNoteName,
  kWelcomeDevSystemNoteName,
  kWelcomeSystemNoteName,
} from "./constants";
import type { BoopFunction } from "./functions";
import { kBuiltInFunctionsSeparator, parseBuiltInFunctions } from "./functions.js";
import { expandKeyHelp } from "./key-helper.js";
import { fixUpNoteContent } from "./note-content";
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

const systemNotes = new Map<string, () => string>([
  [kHelpSystemNoteName, getHelp],
  [kReleaseNotesSystemNoteName, getReleaseNotes],
  [kWelcomeSystemNoteName, getWelcomeNote],
  [kWelcomeDevSystemNoteName, getWelcomeNoteDev],
  [kBuiltInFunctionsNoteName, getBuiltInFunctionsNote],
]);

export function isSystemNoteName(name: string): boolean {
  return systemNotes.has(name);
}

export function getSystemNoteContent(name: string): string | undefined {
  return systemNotes.get(name)?.();
}

function getHelp(): string {
  let help = expandKeyHelp(helpRaw, platformName);
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

function getBuiltInFunctionsNote(): string {
  let s = builtInFunctionsRaw;
  let parts = s.split(kBuiltInFunctionsSeparator);
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

function fixUpNote(s: string): string {
  s = fixUpNoteContent(s);
  s = expandKeyHelp(s);
  return s;
}

function getReleaseNotes(): string {
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

function getWelcomeNoteDev(): string {
  return getWelcomeNote() + scratchDevRaw;
}

export function getMyFunctionsNote(): string {
  return fixUpNote(myFunctionsRaw);
}

let boopFunctions: BoopFunction[] | undefined;

export function getBoopFunctions() {
  return (boopFunctions ??= parseBuiltInFunctions(builtInFunctionsRaw));
}
