/** @typedef {{
  openFind: () => void,
  openContextMenu: (MouseEvent) => void,
  getPassword: (msg: string) => Promise<string>,
  requestFileWritePermission: (fh: FileSystemFileHandle) => Promise<boolean>,
}} GlobalFuncs
*/

import { formatDurationShort } from "./util";

let sessionStart = performance.now();
/**
 * @returns {string}
 */
export function getSessionDur() {
  let durMs = Math.round(performance.now() - sessionStart);
  return formatDurationShort(durMs);
}

// it's easier to make some functions from App.vue available this way
// then elaborate scheme of throwing and catching events
// could also use setContext()
/** @type {GlobalFuncs} */
let globalFunctions;

/**
 * @param {GlobalFuncs} gf
 */
export function setGlobalFuncs(gf) {
  globalFunctions = gf;
}

export function openContextMenu(ev) {
  globalFunctions.openContextMenu(ev);
}

export function openFind() {
  globalFunctions.openFind();
}
/**
 * @param {string} msg
 * @returns {Promise<string>}
 */
export async function getPasswordFromUser(msg) {
  let pwd = await globalFunctions.getPassword(msg);
  console.log("got password:", pwd);
  return pwd;
}

export async function requestFileWritePermission(fh) {
  let ok = await globalFunctions.requestFileWritePermission(fh);
  console.log("ok:", ok);
  // TODO: check permissions
  return ok;
}
