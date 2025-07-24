import { decryptBlobAsString, encryptStringAsBlob, hash } from "kiss-crypto";
import { getPasswordFromUser } from "./globals";

export const kLSPassowrdKey = "elaris-password";

// salt for hashing the password. not sure if it helps security wise
// but it's the best we can do. We can't generate unique salts for
// each password
const kElarisSalt = "360180182a560f063c6acf4a10462817dbd";

/**
 * @param {string} pwd
 */
export function rememberPassword(pwd) {
  localStorage.setItem(kLSPassowrdKey, pwd);
}

export function removePassword() {
  localStorage.removeItem(kLSPassowrdKey);
}

/**
 * @param {string} pwd
 * @returns {string}
 */
export function saltPassword(pwd) {
  let pwdHash = hash({ key: pwd, salt: kElarisSalt });
  return pwdHash;
}

/**
 * @returns {string|null}
 */
export function getPasswordHash() {
  let pwd = localStorage.getItem(kLSPassowrdKey);
  if (!pwd) {
    return null;
  }
  let pwdHash = saltPassword(pwd);
  return pwdHash;
}

/**
 * @returns {boolean}
 */
export function isUsingEncryption() {
  let pwdHash = getPasswordHash();
  return pwdHash ? true : false;
}

/**
 * @param {string} msg
 * @returns {Promise<string>}
 */
export async function getPasswordHashMust(msg) {
  let pwdHash = getPasswordHash();
  let simulateNoPassword = false;
  if (simulateNoPassword) {
    pwdHash = null;
  }
  if (pwdHash) {
    return pwdHash;
  }
  let pwd = await getPasswordFromUser(msg);
  // TODO: we don't know yet if password is correct, maybe move this somewhere else
  rememberPassword(pwd);
  return saltPassword(pwd);
}
