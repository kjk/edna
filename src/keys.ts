// https://keyjs.dev/ : to see what's what

import browser from "./browser";
import { len } from "./util";

/**
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isEsc(ev) {
  return ev.key === "Escape";
}

/**
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isEnter(ev) {
  return ev.key === "Enter";
}

/**
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isUp(ev) {
  return ev.key == "ArrowUp" || ev.key == "Up";
}

/**
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isDown(ev) {
  return ev.key == "ArrowDown" || ev.key == "Down";
}

/**
 * navigation up is: Up or Ctrl-P
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isNavUp(ev) {
  if (isUp(ev)) {
    return true;
  }
  return ev.ctrlKey && ev.code === "KeyP";
}

/**
 * navigation down is: Down or Ctrl-N
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isNavDown(ev) {
  if (isDown(ev)) {
    return true;
  }
  return ev.ctrlKey && ev.code === "KeyN";
}

/**
 * detect F1-F99
 * @param {string} s
 * @returns {boolean}
 */
function isFuncKey(s) {
  return /F\d{1,2}/i.test(s);
}

/**
 * @typedef {Object} Shortcut
 * @property {boolean} shiftKey
 * @property {boolean} ctrlKey
 * @property {boolean} altKey
 * @property {boolean} metaKey // ctrl on windows, command on mac
 * @property {string} key
 * @property {string} [cmdId]
 */

/**
 * @param {Shortcut} s
 * @returns {string}
 */
export function serializeShortuct(s) {
  let res = "";
  if (s.shiftKey) {
    if (browser.mac) {
      res += "⇧ ";
    } else {
      res += "Shift + ";
    }
  }
  if (s.ctrlKey) {
    if (browser.mac) {
      res += "⌃ ";
    } else {
      res += "Ctrl + ";
    }
  }
  if (s.altKey) {
    if (browser.mac) {
      res += "⌥ ";
    } else {
      res += "Alt + ";
    }
  }
  if (s.metaKey) {
    if (browser.mac) {
      res += "⌘ ";
    } else {
      res += "Meta + ";
    }
  }
  res = res + s.key.toUpperCase();
  return res;
}

/**
 * shortuct can be "Ctrl+X" or "Ctrl+Z\tCmd+Z"" (first is for win/linux, second is for mac)
 * @param {string} s
 * @returns {Object}
 */
export function parseShortcut(s) {
  let parts = s.split("\t");
  if (len(parts) > 1) {
    s = parts[0];
    if (browser.mac) {
      s = parts[1];
    }
  }

  // those fields match KeyboardEvent
  /** @type Shortcut */
  let res = {
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    key: "",
  };
  // allow Ctrl++ and Ctrl+- by replacing +/- with "plus"/"minus" and reversing that later
  let s2 = s
    .replace("++", "+plus")
    .replace("+-", "+minus")
    .replace("-+", "+plus")
    .replace("--", "+minus");

  // TODO: special casing for notepad2
  // TODO: this also changes what is show in menu
  s2 = s2
    .replace("(<,)", "")
    .replace("(>.)", "")
    .replace("(>,)", "")
    .replace("(>.)", "");

  // allow "Ctrl + A" and "Ctrl - A"
  s2 = s2.replaceAll("-", "+").replaceAll(" ", "");
  parts = s2.split("+");
  while (len(parts) > 1) {
    let mod = parts.shift();
    if (/^(cmd|meta|m)$/i.test(mod)) res.metaKey = true;
    else if (/^a(lt)?$/i.test(mod)) res.altKey = true;
    else if (/^(c|ctrl|control)$/i.test(mod)) res.ctrlKey = true;
    else if (/^s(hift)?$/i.test(mod)) res.shiftKey = true;
    else if (/^mod$/i.test(mod)) {
      if (browser.mac) res.metaKey = true;
      else res.ctrlKey = true;
    } else {
      // console.log("Unrecognized modifier name: " + mod + " in: " + s);
      return null;
    }
  }
  const key = parts[0];
  const keyL = key.toLowerCase();
  const keyU = keyL.toUpperCase();
  if (len(key) === 1) {
    if (keyL >= "a" && keyL <= "z") {
      res.key = res.shiftKey ? keyU : keyL;
      return res;
    }
    if (key >= "0" && key <= "9") {
      res.key = key;
      return res;
    }
    if (["+", "-"].includes(key)) {
      res.key = key;
      return res;
    }
  }
  if (isFuncKey(key)) {
    res.key = key;
    return res;
  }
  switch (keyL) {
    case "del":
    case "delete":
      res.key = "Delete";
      break;
    case "backspace":
    case "back":
      res.key = "Backspace";
      break;
    case "esc":
    case "escape":
      res.key = "Escape";
      break;
    case "space":
      res.key = " ";
      break;
    case "plus":
      res.key = "+";
      break;
    case "minus":
      res.key = "-";
      break;
    // the keys are ",." but in KeyboardEvent.key they show up as "<>"
    case "comma":
      // res.key = ",";
      res.key = "<";
      break;
    case "period":
      // res.key = ".";
      res.key = ">";
      break;
  }
  if (res.key !== "") {
    return res;
  }
  // TODO: validate more like up/down etc.
  res.key = key;
  return res;
}

export function extractShortcut(txt) {
  const s = parseShortcut(txt);
  if (s === null) {
    return txt;
  }
  const res = serializeShortuct(s);
  return res;
}
