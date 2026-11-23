let host = globalThis.window ? window.location.host : "";

export function isDev() {
  return host.startsWith("localhost");
}

export function len(o: any): number {
  return o ? o.length : 0;
}

export function throwIf(cond: boolean, msg?: string) {
  if (cond) {
    throw new Error(msg || "invalid condition");
  }
}

export function objectEqualDeep(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// sets obj[key] = value unless it's already equal; returns true if it changed
export function assignIfChanged<T, K extends keyof T>(obj: T, key: K, value: T[K]): boolean {
  if (objectEqualDeep(obj[key], value)) {
    return false;
  }
  obj[key] = value;
  return true;
}

export let platform = {
  // default to windows
  isMac: false,
  isWindows: true,
  isLinux: false,
};

export let platformName: string;

let uadPlat, navPlat;
let nav = typeof window !== "undefined" ? window.navigator : null;
if (nav) {
  // @ts-ignore
  uadPlat = nav.userAgentData?.platform;
  navPlat = nav.platform;
}
// in Deno there is window.navigator but no window.navigator.platform so we default to "Win"
// it doesn't matter, it's only so we can run gen.js script in deno because node refuses to run it
const uaPlatform = uadPlat || navPlat || "Win";
if (uaPlatform.indexOf("Win") !== -1) {
  platformName = "windows";
} else if (uaPlatform.indexOf("Linux") !== -1) {
  platform = {
    isMac: false,
    isWindows: false,
    isLinux: true,
  };
  platformName = "linux";
} else {
  platform = {
    isMac: true,
    isWindows: false,
    isLinux: false,
  };
  platformName = "darwin";
}

export function getModChar(platform = platformName): string {
  return platform === "darwin" ? "⌘" : "Ctrl";
}

export function getAltChar(platform = platformName): string {
  return platform === "darwin" ? "⌥" : "Alt";
}

// e.g. "Alt + 3" for quick access shortcut n
// Mod key (Command on Mac, Ctrl elsewhere) is pressed
export function isModKey(ev: KeyboardEvent | MouseEvent): boolean {
  return platform.isMac ? ev.metaKey : ev.ctrlKey;
}

// true if ev is the key described by a CodeMirror-style spec like "Mod-Shift-k"
export function keySpecMatches(spec: string, ev: KeyboardEvent): boolean {
  let parts = spec.split("-");
  let key = parts.pop()!;
  return (
    ev.key.toLowerCase() === key.toLowerCase() &&
    isModKey(ev) === parts.includes("Mod") &&
    ev.shiftKey === parts.includes("Shift") &&
    ev.altKey === parts.includes("Alt")
  );
}

export function altShortcutStr(n: number | string): string {
  return getAltChar() + " + " + n;
}

const utf8Encoder = new TextEncoder(); // perf: a single globar encoder

export function toUtf8(text: string): Uint8Array {
  return utf8Encoder.encode(text);
}

// Maybe(perf): if text.length > 1 MB, return text.length
// TODO(perf): don't allocate utf8Bytes, iterate over chars and count bytes
export function stringSizeInUtf8Bytes(text: string): number {
  let utf8Bytes = toUtf8(text);
  return utf8Bytes.length;
}

export function fmtSize(n: number): string {
  const a: [number, string][] = [
    [1024 * 1024 * 1024 * 1024, "TB"],
    [1024 * 1024 * 1024, "GB"],
    [1024 * 1024, "MB"],
    [1024, "kB"],
  ];
  for (const el of a) {
    const size = Number(el[0]); // cast just to appease TS
    if (n >= size) {
      let s = (n / size).toFixed(2);
      return s.replace(".00", "") + " " + el[1];
    }
  }
  return `${n} B`;
}

export function formatDurationShort(ms: number): string {
  const days = Math.floor(ms / 86400000); // 1 day = 86400000 ms
  const hours = Math.floor((ms % 86400000) / 3600000); // 1 hour = 3600000 ms
  const mins = Math.floor((ms % 3600000) / 60000); // 1 minute = 60000 ms
  const secs = Math.floor((ms % 60000) / 1000); // 1 second = 1000 ms

  let res = "";

  if (days > 0) res += `${days} d${days > 1 ? "s" : ""} `;
  if (hours > 0) res += `${hours} hr${hours > 1 ? "s" : ""} `;
  if (mins > 0) res += `${mins} min${mins > 1 ? "s" : ""} `;
  if (secs > 0) res += `${secs} sec${secs > 1 ? "s" : ""}`;
  return res.trim();
}

export function startTimer(): () => number {
  const timeStart = performance.now();
  return function () {
    return Math.round(performance.now() - timeStart);
  };
}

export function formatDateYYYYMMDD(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatDateYYYYMMDDDay(date = new Date()): string {
  return `${formatDateYYYYMMDD(date)} ${daysOfWeek[date.getDay()]}`;
}

export function isAltNumEvent(e: KeyboardEvent): string | null {
  if (e.metaKey || e.ctrlKey || e.shiftKey || !e.altKey) {
    return null;
  }
  // on Mac we can't use e.key because it ends up some composed character
  // we can use e.code whch is "Digit0" => "Digit9"
  // or e.keyCode (48-57) or e.which (48-57)
  if (e.keyCode < 48 || e.keyCode > 57) {
    return null;
  }
  return String.fromCharCode(e.keyCode);
}

// adds an entry for the Home tab: URL without a note name in the hash.
// Replaces the current entry if it has no note (e.g. at startup)
export function addHomeToBrowserHistory(homeTab: string) {
  if (window.history.state?.noteName === homeTab) {
    return;
  }
  // @ts-ignore
  let url = new URL(window.location);
  url.hash = "";
  let hadNote = !!window.history.state?.noteName || window.location.hash !== "";
  if (hadNote) {
    window.history.pushState({ noteName: homeTab }, "", url);
  } else {
    window.history.replaceState({ noteName: homeTab }, "", url);
  }
}

// replace: update the current entry instead of adding one (e.g. after a rename,
// so that Back doesn't go to the note's old name)
export function addNoteToBrowserHistory(noteName: string, replace = false) {
  // @ts-ignore
  let url = new URL(window.location);
  url.hash = encodeURIComponent(noteName);
  // update browser's URL without reloading the page
  if (replace) {
    window.history.replaceState({ noteName: noteName }, noteName, url);
  } else {
    window.history.pushState({ noteName: noteName }, noteName, url);
  }
}

let cachedScrollbarDx = 0;

// style that keeps a fixed, right-aligned element clear of the vertical scrollbar
export function scrollbarOffsetStyle(): string {
  return `right: ${getScrollbarWidth()}px`;
}

export function getScrollbarWidth(): number {
  /*
  needs the following css:
  .scrollbar-width-detector {
    position: absolute;
    visibility: hidden;
    width: 100px;
    height: 100px;
    overflow: scroll;
  }
*/
  if (cachedScrollbarDx > 0) {
    return cachedScrollbarDx;
  }
  const el = document.createElement("div");
  el.className = "scrollbar-width-detector";
  document.body.appendChild(el);
  cachedScrollbarDx = el.offsetWidth - el.clientWidth;
  document.body.removeChild(el);
  return cachedScrollbarDx;
}

export function splitMax(s: string, sep: string, max: number): string[] {
  throwIf(max === 0);
  let parts = s.split(sep);
  if (parts.length <= max) {
    return parts;
  }
  let restParts = parts.slice(max - 1);
  let restStr = restParts.join(sep);
  parts[max - 1] = restStr;
  return parts.slice(0, max);
}

export function trimPrefix(s: string, prefix: string): string {
  if (!s.startsWith(prefix)) {
    return s;
  }
  return s.substring(prefix.length);
}

export function trimSuffix(s: string, suffix: string): string {
  if (!s.endsWith(suffix)) {
    return s;
  }
  return s.substring(0, s.length - suffix.length);
}

// value of p, or undefined if it fails (logged with what, if given)
export async function valueOrUndefined<T>(p: Promise<T>, what?: string): Promise<T | undefined> {
  try {
    return await p;
  } catch (e) {
    if (what) {
      console.log(what, e);
    }
    return undefined;
  }
}

// message of an Error, or e as a string for anything else that was thrown
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// value parsed from JSON in s, or undefined if s isn't valid JSON (logged as error
// about what; onInvalid is called e.g. to keep a copy of the corrupted data)
export function tryParseJSON(s: string, what: string, onInvalid?: () => void): unknown {
  try {
    return JSON.parse(s);
  } catch (e) {
    console.error(`${what} is not valid JSON`, e);
    onInvalid?.();
    return undefined;
  }
}

// like tryParseJSON() but {} unless s is a JSON object
export function tryParseJSONObject(s: string, what: string): Record<string, any> {
  let v = tryParseJSON(s, what);
  return v && typeof v === "object" ? v : {};
}

// sort comparator part: items with a true flag go first (0 if both are the same)
export function compareTrueFirst(a: boolean | undefined, b: boolean | undefined): number {
  return Number(!!b) - Number(!!a);
}

// comparator: starred items first, then by name
export function starredThenName<T>(isStarred: (t: T) => boolean, name: (t: T) => string): (a: T, b: T) => number {
  return (a, b) => compareTrueFirst(isStarred(a), isStarred(b)) || name(a).localeCompare(name(b));
}

// number of characters at the start of a and b that are the same
export function commonPrefixLen(a: string, b: string): number {
  let n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// adds item to list, or merges it into the last item (merge()) if canMerge()
export function pushOrMerge<T>(
  list: T[],
  item: T,
  canMerge: (last: T, item: T) => boolean,
  merge: (last: T, item: T) => void,
) {
  const last = list.at(-1);
  if (last !== undefined && canMerge(last, item)) {
    merge(last, item);
  } else {
    list.push(item);
  }
}

// lengths of the common start of a and b, and of their common end that doesn't
// overlap the start
export function commonAffixLens(a: string, b: string): { prefix: number; suffix: number } {
  const prefix = commonPrefixLen(a, b);
  const limit = Math.min(a.length, b.length) - prefix;
  let suffix = 0;
  while (suffix < limit && a.charCodeAt(a.length - suffix - 1) === b.charCodeAt(b.length - suffix - 1)) suffix++;
  return { prefix, suffix };
}

// items of a without repeats, in order of first appearance
export function removeDuplicates<T>(a: T[]): T[] {
  return [...new Set(a)];
}

// true if every part occurs in s (and accept() approves its first occurrence)
export function stringMatchesParts(
  s: string,
  parts: string[],
  accept: (idx: number, part: string) => boolean = () => true,
): boolean {
  return parts.every((part) => {
    let idx = s.indexOf(part);
    return idx >= 0 && accept(idx, part);
  });
}

export function findMatchingItems(items: any[], filter: string, itemKey: string): any[] {
  return findMatchingItemsFn(items, filter, (item) => item[itemKey]);
}

export function findMatchingItemsFn(items: any[], filter: string, itemKeyFn: (item: any) => any): any[] {
  filter = filter.trim();
  if (filter === "") {
    return [...items];
  }
  filter = filter.toLowerCase();
  let filterParts = filter.split(" ");
  for (let [i, part] of filterParts.entries()) {
    filterParts[i] = part.trim();
  }
  // perf: pre-allocate result to max capacity
  let res = Array(len(items));
  let i = 0;
  for (let item of items) {
    let key = itemKeyFn(item);
    if (!stringMatchesParts(key, filterParts)) {
      continue;
    }
    res[i++] = item;
  }
  res.length = i;
  return res;
}

export function ensureStringEndsWithNL(s: string): string {
  if (!s.endsWith("\n")) {
    return s + "\n";
  }
  return s;
}

const charCode0 = "0".charCodeAt(0);

export function getKeyEventNumber(ev: KeyboardEvent): number {
  // TODO: key could be a string like "Enter", not sure
  // if any of them could start with a number
  let n = ev.key.charCodeAt(0) - charCode0;
  if (n < 0 || n > 9) {
    return -1;
  }
  return n;
}

// if ev is a digit key '0' ... '9' less than nItems, calls pick(digit) and returns true
export function handleDigitPick(ev: KeyboardEvent, nItems: number, pick: (idx: number) => void): boolean {
  let idx = getKeyEventNumber(ev);
  if (idx < 0 || idx >= nItems) {
    return false;
  }
  ev.preventDefault();
  pick(idx);
  return true;
}

export async function getClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    // console.error("Error reading clipboard text:", error);
    return "";
  }
}

export function noOp() {
  // do nothing
}

export function isWholeWord(s: string, startIdx: number, endIdx: number): boolean {
  // Ensure indices are within the string boundaries
  if (startIdx < 0 || endIdx > s.length || startIdx >= endIdx) {
    return false;
  }
  // Check if the start boundary is the beginning of the string or a non-word character
  const startOk = startIdx === 0 || /\W/.test(s[startIdx - 1]!);
  // Check if the end boundary is the end of the string or a non-word character
  const endOk = endIdx === s.length || /\W/.test(s[endIdx]!);

  return startOk && endOk;
}

export function splitStringPreservingQuotes(input: string): string[] {
  // This regex matches sequences of characters that are either:
  // 1. Enclosed in double quotes ("quoted text")
  // 2. Non-space characters (words)
  const regex = /"([^"]*)"|\S+/g;
  let result = [];
  let match;
  while ((match = regex.exec(input)) !== null) {
    // If it's a quoted match, remove the quotes
    if (match[1]) {
      result.push(match[1]);
    } else {
      result.push(match[0]);
    }
  }
  return result;
}

export function makeHilightRegExp(filter: string): RegExp {
  let parts = splitStringPreservingQuotes(filter);
  let a = [];
  for (let s of parts) {
    s = s.trim().toLowerCase();
    let escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    a.push(escaped);
  }
  let s = a.join("|");
  return new RegExp(`(${s})`, "gi");
}

export function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// tagged template: interpolated values are HTML-escaped, so html`<b>${name}</b>` is safe for {@html}
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  let res = strings[0];
  for (let i = 0; i < values.length; i++) {
    res += escapeHTML(String(values[i])) + strings[i + 1];
  }
  return res;
}

// returns HTML: s is escaped and matches of regexp are wrapped in <span class="hili">
export function hilightText(s: string, regexp: RegExp): string {
  let res = "";
  let last = 0;
  for (const m of s.matchAll(regexp)) {
    if (m[0].length === 0) {
      continue;
    }
    res += escapeHTML(s.slice(last, m.index)) + '<span class="hili">' + escapeHTML(m[0]) + "</span>";
    last = m.index + m[0].length;
  }
  return res + escapeHTML(s.slice(last));
}

export function pushIfNotExists(arr: any[], item: any) {
  if (!arr.includes(item)) {
    arr.push(item);
  }
}

// removes arr[i] if i is a valid index (e.g. not -1 from indexOf)
export function arrayRemoveAt(arr: any[], i: number) {
  if (i >= 0 && i < arr.length) {
    arr.splice(i, 1);
  }
}

export function arrayRemove(arr: any[], item: any) {
  arrayRemoveAt(arr, arr.indexOf(item));
}

// replaces first item equal to oldItem with newItem
export function arrayReplace<T>(arr: T[], oldItem: T, newItem: T) {
  let i = arr.indexOf(oldItem);
  if (i >= 0) {
    arr[i] = newItem;
  }
}

export function isKeyCtrlDelete(ev: KeyboardEvent): boolean {
  return (ev.key === "Delete" || ev.key === "Backspace") && ev.ctrlKey;
}

export function isKeyEnter(ev: KeyboardEvent): boolean {
  return ev.key === "Enter";
}

export function isKeyUp(ev: KeyboardEvent): boolean {
  return ev.key === "ArrowUp" || ev.key === "Up";
}

export function isKeyDown(ev: KeyboardEvent): boolean {
  return ev.key === "ArrowDown" || ev.key === "Down";
}

export function isKeyCtrlEnter(ev: KeyboardEvent): boolean {
  return isKeyEnter(ev) && ev.ctrlKey;
}

// css classes for a toggle button (e.g. "match case" in find)
export function btnPressedCls(isPressed: boolean): string {
  return isPressed ? "bg-gray-100 border-1 border-gray-300" : "bg-white border-1 border-white";
}

// e.g. "12 notes" or "3 of 12 notes"; "" if nothing matches and hideWhenNone
// (so the count doesn't obscure a long name the user is typing)
export function filteredCountMsg(nFiltered: number, nTotal: number, noun: string, hideWhenNone = true): string {
  if (nFiltered === 0 && hideWhenNone) {
    return "";
  }
  if (nFiltered === nTotal) {
    return `${nTotal} ${noun}`;
  }
  return `${nFiltered} of ${nTotal} ${noun}`;
}

// list that handles navigation keys (ListBox)
export interface KeyNavigableList {
  onkeydown(ev: KeyboardEvent, allowLeftRight: boolean): boolean;
}

// keydown in a dialog with a list: the first of handlers that returns true
// handles ev; otherwise the list does (moves selection, Enter picks the item).
// allowLeftRight: Left / Right also move selection (e.g. when filter is empty)
export function handleListKeydown(
  ev: KeyboardEvent,
  list: KeyNavigableList | undefined,
  allowLeftRight: boolean,
  ...handlers: ((ev: KeyboardEvent) => boolean)[]
) {
  for (let handler of handlers) {
    if (handler(ev)) {
      return;
    }
  }
  list?.onkeydown(ev, allowLeftRight);
}

// if ev is Enter: prevent default (and propagation if stop), call fn and return true
export function handleEnter(ev: KeyboardEvent, fn: (ev: KeyboardEvent) => void, stop = false): boolean {
  if (!isKeyEnter(ev)) {
    return false;
  }
  ev.preventDefault();
  if (stop) {
    ev.stopPropagation();
  }
  fn(ev);
  return true;
}

// keydown handler for dialogs: Enter calls submit() if canSubmit and swallows the
// event (also when it can't submit if alwaysSwallow)
export function submitOnEnter(ev: KeyboardEvent, canSubmit: boolean, submit: () => void, alwaysSwallow = false) {
  if (canSubmit || alwaysSwallow) {
    handleEnter(ev, () => canSubmit && submit(), true);
  }
}

// if ev is Alt + S and there's a selected item, toggles its star; returns true if handled
export function handleToggleStarKey<T>(ev: KeyboardEvent, selected: T | undefined | null, toggle: (item: T) => void) {
  if (ev.key === "s" && ev.altKey && selected) {
    ev.preventDefault();
    toggle(selected);
    return true;
  }
  return false;
}

// runs toggle() (e.g. toggling star of an item) and then gives focus back to focusEl
export async function toggleStarredAndFocus(toggle: () => unknown, focusEl?: HTMLElement) {
  await toggle();
  focusEl?.focus();
}

// flips boolean property obj[key]
export function toggleFlag<T, K extends { [P in keyof T]: T[P] extends boolean ? P : never }[keyof T]>(obj: T, key: K) {
  (obj as any)[key] = !obj[key];
}

// removes item from arr if present, adds it otherwise
export function toggleInArray<T>(arr: T[], item: T) {
  if (arr.includes(item)) {
    arrayRemove(arr, item);
  } else {
    arr.push(item);
  }
}

export function humanPrice(price: number): string {
  if (price == 0) {
    return "0";
  }
  let p = price * 1000000;
  let res = "$" + p.toFixed(2);
  if (res.endsWith(".00")) {
    res = res.slice(0, -3);
  }
  return res;
}

// runs task after prev settles; returns task's promise and a never-rejecting
// promise that settles with it (the next prev)
function chainTask<T>(prev: Promise<unknown>, task: () => Promise<T>): [Promise<T>, Promise<unknown>] {
  let p = prev.then(task);
  return [p, p.catch(() => {})];
}

// runs tasks one at a time, in the order they were added. A failed task
// doesn't stop the ones after it
export class SerialQueue {
  private last: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    let p: Promise<T>;
    [p, this.last] = chainTask(this.last, task);
    return p;
  }
}

// like SerialQueue but with a separate queue for each key
export class KeyedSerialQueue {
  private queues = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    let [p, done] = chainTask(this.queues.get(key) ?? Promise.resolve(), task);
    this.queues.set(key, done);
    done.then(() => {
      if (this.queues.get(key) === done) {
        this.queues.delete(key);
      }
    });
    return p;
  }
}
