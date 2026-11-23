import PasswordPrompt from "./components/PasswordPrompt.svelte";
import { mountInNewDiv, unmountAndRemove } from "./mount-util";
import { getSessionDurationInMs } from "./state";
import { formatDurationShort } from "./util";

export interface GlobalFuncs {
  focusEditor: () => void;
  getPasswordFromUser: (msg: string) => Promise<string>;
  requestFileWritePermission: (fh: FileSystemFileHandle) => Promise<boolean>;
  updateAfterNoteStateChange: () => void;
}

export function getSessionDur(): string {
  return formatDurationShort(getSessionDurationInMs());
}

// it's easier to make some functions from App.vue available this way
// then elaborate scheme of throwing and catching events
// could also use setContext()
// undefined when App is not mounted (e.g. permissions screen, or between
// unmounting and re-mounting App while booting)
let globalFunctions: GlobalFuncs | undefined;

export function setGlobalFuncs(gf: GlobalFuncs | undefined) {
  globalFunctions = gf;
}

// clears functions set by an App instance, unless another App replaced them
export function clearGlobalFuncs(gf: GlobalFuncs) {
  if (globalFunctions === gf) {
    globalFunctions = undefined;
  }
}

export function focusEditor() {
  globalFunctions?.focusEditor();
}

export function updateAfterNoteStateChange() {
  globalFunctions?.updateAfterNoteStateChange();
}

// asks the user for a password; resolves "" if cancelled
export async function getPasswordFromUser(msg: string): Promise<string> {
  if (globalFunctions) {
    return await globalFunctions.getPasswordFromUser(msg);
  }
  return await getPasswordStandalone(msg);
}

// shows a dialog and resolves with the user's answer: show(answer) displays
// the dialog, which calls answer(v) to hide it (with hide()) and resolve with v
export function askUser<T>(show: (answer: (v: T) => void) => void, hide: () => void): Promise<T> {
  return new Promise((resolve) =>
    show((v) => {
      hide();
      resolve(v);
    }),
  );
}

export interface PasswordPromptProps {
  msg: string;
  onpassword: (pwd: string) => void;
  onclose: () => void;
}

// asks for a password with a PasswordPrompt that show() displays with the given
// props and hide() removes; resolves "" if cancelled
export function askPassword(msg: string, show: (props: PasswordPromptProps) => void, hide: () => void): Promise<string> {
  return askUser((answer) => show({ msg, onpassword: answer, onclose: () => answer("") }), hide);
}

// password dialog when App isn't mounted (issue 15f in docs/state-machines.md)
function getPasswordStandalone(msg: string): Promise<string> {
  let mounted: ReturnType<typeof mountInNewDiv> | undefined;
  return askPassword(
    msg,
    (props) => (mounted = mountInNewDiv(PasswordPrompt, props)),
    () => unmountAndRemove(mounted?.target, mounted?.comp),
  );
}

export async function requestFileWritePermission(fh: FileSystemFileHandle): Promise<boolean> {
  if (!globalFunctions) {
    return false;
  }
  return await globalFunctions.requestFileWritePermission(fh);
}
