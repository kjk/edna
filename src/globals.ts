import { mount, unmount } from "svelte";
import PasswordPrompt from "./components/PasswordPrompt.svelte";
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

// password dialog when App isn't mounted (issue 15f in docs/state-machines.md)
function getPasswordStandalone(msg: string): Promise<string> {
  return new Promise((resolve) => {
    let target = document.createElement("div");
    document.body.appendChild(target);
    let comp: ReturnType<typeof mount> | undefined;
    let finish = (pwd: string) => {
      if (comp) {
        unmount(comp);
        comp = undefined;
      }
      target.remove();
      resolve(pwd);
    };
    comp = mount(PasswordPrompt, {
      target,
      props: { msg, onpassword: (pwd: string) => finish(pwd), onclose: () => finish("") },
    });
  });
}

export async function requestFileWritePermission(fh: FileSystemFileHandle): Promise<boolean> {
  if (!globalFunctions) {
    return false;
  }
  return await globalFunctions.requestFileWritePermission(fh);
}
