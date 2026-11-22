// helps avoid circular references
export const kScratchNoteName = "scratch";
export const kDailyJournalNoteName = "daily journal";
export const kInboxNoteName = "inbox";
export const kMyFunctionsNoteName = "edna: my functions";

export const kHelpSystemNoteName = "system:help";
export const kReleaseNotesSystemNoteName = "system:Release Notes";
export const kWelcomeSystemNoteName = "system:welcome";
export const kWelcomeDevSystemNoteName = "system:welcome dev";
export const kBuiltInFunctionsNoteName = "system:built in functions";

export const blockHdrMarkdown = "\n∞∞∞markdown\n";
export const blockHdrJavaScript = "\n∞∞∞javascript\n";

export const kSettingsPath = "settings.json";

export const kEdnaFileExt = ".edna.txt";
export const kEdnaEncrFileExt = ".encr.edna.txt";

export const kTabHome = "__home:";
export function isTabHome(tab: string): boolean {
  return tab === kTabHome;
}
export function noteNameFromTab(tab: string): string | undefined {
  if (isTabHome(tab)) return undefined;
  return tab;
}
