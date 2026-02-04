// https://keyjs.dev/ : to see what's what

import browser from "./browser";
import { len } from "./util";

export function isEsc(ev: KeyboardEvent): boolean {
  return ev.key === "Escape";
}

export function isEnter(ev: KeyboardEvent): boolean {
  return ev.key === "Enter";
}

export function isUp(ev: KeyboardEvent): boolean {
  return ev.key == "ArrowUp" || ev.key == "Up";
}

export function isDown(ev: KeyboardEvent): boolean {
  return ev.key == "ArrowDown" || ev.key == "Down";
}

export function isNavUp(ev: KeyboardEvent): boolean {
  if (isUp(ev)) {
    return true;
  }
  return ev.ctrlKey && ev.code === "KeyP";
}

export function isNavDown(ev: KeyboardEvent): boolean {
  if (isDown(ev)) {
    return true;
  }
  return ev.ctrlKey && ev.code === "KeyN";
}

function isFuncKey(s: string): boolean {
  return /F\d{1,2}/i.test(s);
}

export interface Shortcut {
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean; // ctrl on windows, command on mac
  key: string;
  cmdId?: string;
}

export function serializeShortuct(s: Shortcut): string {
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

export function parseShortcut(s: string): Shortcut | null {
  let parts = s.split("\t");
  if (len(parts) > 1) {
    s = parts[0]!;
    if (browser.mac) {
      s = parts[1]!;
    }
  }

  // those fields match KeyboardEvent
  let res: Shortcut = {
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
    let mod = parts.shift()!;
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
  const key = parts[0]!;
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

export function extractShortcut(txt: string): string {
  const s = parseShortcut(txt);
  if (s === null) {
    return txt;
  }
  const res = serializeShortuct(s);
  return res;
}
