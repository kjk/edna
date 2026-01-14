import { appState } from "./appstate.svelte";
import { elarisFetch } from "./httputil";
import { error, log } from "./log";
import { getLocalStorageAsJSON, setLocalStorageFromJSON } from "./util";

export type UserInfo = {
  user: string;
  email: string;
  login: string;
  avatar_url?: string;
};

// returns user info if logged in, null if not logged in

const kCachedUserKey = "elaris:cacheduser";

export async function getLoggedUser(): Promise<UserInfo | null> {
  let user = null;
  try {
    let rsp = await elarisFetch("/auth/user");
    if (rsp.status !== 200) {
      return null;
    }
    user = await rsp.json();
  } catch (e) {
    error("getLoggedUser: error:", e);
    let s = localStorage.getItem(kCachedUserKey);
    if (s) {
      user = JSON.parse(s);
    }
    return user;
  }
  if (user.error) {
    log("getLoggedUser: error:", user.error);
    return null;
  }
  localStorage.setItem(kCachedUserKey, JSON.stringify(user));
  return user;
}
