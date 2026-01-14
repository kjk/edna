import { decryptBlobAsString, encryptStringAsBlob, hash } from "kiss-crypto";
import { modalInfoState } from "./components/ModalInfo.svelte";
import { getPasswordFromUser } from "./globals";

export const kLSPassowrdKey = "elaris-password";

// salt for hashing the password. not sure if it helps security wise
// but it's the best we can do. We can't generate unique salts for
// each password
const kElarisSalt = "360180182a560f063c6acf4a10462817dbd";

export function rememberPassword(pwd: string) {
  localStorage.setItem(kLSPassowrdKey, pwd);
}

export function removePassword() {
  localStorage.removeItem(kLSPassowrdKey);
}

export function saltPassword(pwd: string): string {
  let pwdHash = hash({ key: pwd, salt: kElarisSalt });
  return pwdHash;
}

export function getPasswordHash(): string | null {
  let pwd = localStorage.getItem(kLSPassowrdKey);
  if (!pwd) {
    return null;
  }
  let pwdHash = saltPassword(pwd);
  return pwdHash;
}

export function isUsingEncryption(): boolean {
  let pwdHash = getPasswordHash();
  return pwdHash ? true : false;
}

export async function getPasswordHashMust(msg: string): Promise<string> {
  let pwdHash = getPasswordHash();
  let simulateNoPassword = false;
  if (simulateNoPassword) {
    pwdHash = null;
  }
  if (pwdHash) {
    return pwdHash;
  }
  modalInfoState.hide();
  let pwd = await getPasswordFromUser(msg);
  // TODO: we don't know yet if password is correct, maybe move this somewhere else
  rememberPassword(pwd);
  modalInfoState.show();
  return saltPassword(pwd);
}
