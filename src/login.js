import { appState } from "./appstate.svelte";
import { error, log } from "./log";
import { getLocalStorageAsJSON, setLocalStorageFromJSON } from "./util";

/** @typedef {{
  user: string;
  email: string;
  login: string;
  avatar_url?: string;
}} UserInfo */

// returns user info if logged in, null if not logged in

/**
 * @returns {Promise<UserInfo|null>}
 */
export async function getLoggedUser() {
  let user = null;
  try {
    let rsp = await fetch("/auth/user");
    if (rsp.status !== 200) {
      return null;
    }
    user = await rsp.json();
  } catch (e) {
    error("getLoggedUser: error:", e);
    return null;
  }
  if (user.error) {
    log("getLoggedUser: error:", user.error);
    return null;
  }
  return user;
}
