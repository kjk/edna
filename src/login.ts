import { appFetch } from "./httputil";
import { error, log } from "./log";

export type UserInfo = {
  user: string;
  email: string;
  login: string;
  avatar_url?: string;
};

// returns user info if logged in, null if not logged in

const kCachedUserKey = "elaris:cacheduser";

export async function getLoggedUser(): Promise<UserInfo | undefined> {
  let user: any;
  try {
    let rsp = await appFetch("/auth/user");
    if (rsp.status !== 200) {
      return;
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
    return;
  }
  localStorage.setItem(kCachedUserKey, JSON.stringify(user));
  return user;
}
