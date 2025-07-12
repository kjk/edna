import { get, writable } from "svelte/store";
import { error, log } from "./log.js";
import { getLocalStorageAsJSON, setLocalStorageFromJSON } from "./util.js";

// TODO: must distinguish between offline (was lgged in but cannot reach server)
// and not logged in

// localStorage key for user info
const keyUserInfo = "elaris:user-info";

const um = getLocalStorageAsJSON(keyUserInfo);
// console.log("store: um:", um);
export const userInfo = writable(um);

export function getUserLogin() {
  const v = get(userInfo);
  if (!v) {
    return "";
  }
  return v.login;
}

function storeUserInfo(v) {
  if (v === null) {
    // we set to empty value first so that other windows get notified
    localStorage.setItem(keyUserInfo, "null");
    localStorage.removeItem(keyUserInfo);
  } else {
    setLocalStorageFromJSON(keyUserInfo, v);
  }
  userInfo.set(v);
}

function clearUserInfo() {
  storeUserInfo(null);
}

// only called when value is set from a different window
// we want to know about changes to github token value
// because they indicate the user loggin it, which happens
// in a separate window
async function handleStorageChanged(e) {
  if (e.key !== keyUserInfo) {
    return;
  }
  const ui = e.newValue;
  console.log("user info changed to:", ui);
  if (!ui) {
    // shouldn't happen
    return;
  }
  // TODO:
  // - when moving from logged in to logged out, clear the data
  // - when moving from logged out to logged in, load the data
  if (ui === "null") {
    storeUserInfo(null);
    return;
  }
  let o = JSON.parse(ui);
  storeUserInfo(o);
}

window.addEventListener("storage", handleStorageChanged);

export function logout() {
  storeUserInfo(null);
}

// returns user info if logged in, null if not logged in

export async function getLoggedUser() {
  let user = null;
  try {
    let rsp = await fetch("/auth/user");
    if (rsp.status !== 200) {
      clearUserInfo();
      return null;
    }
    user = await rsp.json();
  } catch (e) {
    error("checkIsLoggedIn: error:", e);
    clearUserInfo();
    return null;
  }
  if (user.error) {
    log("checkIsLoggedIn: error:", user.error);
    clearUserInfo();
    return null;
  }
  storeUserInfo(user);
  return user;
}
