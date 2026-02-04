import { formatDurationShort } from "./util";

export interface GlobalFuncs {
  focusEditor: () => void;
  getPassword: (msg: string) => Promise<string>;
  requestFileWritePermission: (fh: FileSystemFileHandle) => Promise<boolean>;
  updateAfterNoteStateChange: () => void;
}

let sessionStart = performance.now();

export function getSessionDur(): string {
  let durMs = Math.round(performance.now() - sessionStart);
  return formatDurationShort(durMs);
}

// it's easier to make some functions from App.vue available this way
// then elaborate scheme of throwing and catching events
// could also use setContext()
let globalFunctions: GlobalFuncs;

export function setGlobalFuncs(gf: GlobalFuncs) {
  globalFunctions = gf;
}

export function focusEditor() {
  globalFunctions.focusEditor();
}

export function updateAfterNoteStateChange() {
  globalFunctions?.updateAfterNoteStateChange();
}

export async function getPasswordFromUser(msg: string): Promise<string> {
  let pwd = await globalFunctions.getPassword(msg);
  console.log("got password:", pwd);
  return pwd;
}

export async function requestFileWritePermission(fh: FileSystemFileHandle): Promise<boolean> {
  let ok = await globalFunctions.requestFileWritePermission(fh);
  console.log("ok:", ok);
  // TODO: check permissions
  return ok;
}
