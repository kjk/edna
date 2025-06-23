/** @typedef {{
  getPassword: (msg: string) => Promise<string>,
  requestFileWritePermission: (fh: FileSystemFileHandle) => Promise<boolean>,
}} GlobalFuncs
*/

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
