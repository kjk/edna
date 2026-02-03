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

export function cloneObjectShallow(o: any): any {
  // could also be return { ...o };
  return Object.assign({}, o);
}

export function cloneObjectDeep(o: any): any {
  return JSON.parse(JSON.stringify(o));
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

export function formatDuration(ms: number): string {
  const days = Math.floor(ms / 86400000); // 1 day = 86400000 ms
  const hours = Math.floor((ms % 86400000) / 3600000); // 1 hour = 3600000 ms
  const mins = Math.floor((ms % 3600000) / 60000); // 1 minute = 60000 ms
  const secs = Math.floor((ms % 60000) / 1000); // 1 second = 1000 ms

  let res = "";

  if (days > 0) res += `${days} day${days > 1 ? "s" : ""} `;
  if (hours > 0) res += `${hours} hour${hours > 1 ? "s" : ""} `;
  if (mins > 0) res += `${mins} minute${mins > 1 ? "s" : ""} `;
  if (secs > 0) res += `${secs} second${secs > 1 ? "s" : ""}`;
  return res.trim();
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
  let year = date.getFullYear();
  let month = ("0" + (date.getMonth() + 1)).slice(-2); // Months are zero based
  let day = ("0" + date.getDate()).slice(-2);
  let dayOfWeek = date.getDay();
  let dayName = daysOfWeek[dayOfWeek];
  let formattedDate = `${year}-${month}-${day} ${dayName}`;
  return formattedDate;
}

export function fileExt(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  const ext = fileName.substring(idx);
  return ext.toLowerCase();
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

export function addNoteToBrowserHistory(noteName: string) {
  // @ts-ignore
  let url = new URL(window.location);
  url.hash = encodeURIComponent(noteName);
  // update browser's URL without reloading the page
  window.history.pushState({ noteName: noteName }, noteName, url);
  console.log("window.history.pushState:", noteName);
}

let sleepSetTimeout_ctrl;

export function sleep(ms: number): Promise<void> {
  clearInterval(sleepSetTimeout_ctrl);
  return new Promise(
    (resolve) => (sleepSetTimeout_ctrl = setTimeout(resolve, ms)),
  );
}

let cachedScrollbarDx = 0;

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

export function removeDuplicates(a: string[]): string[] {
  let res = new Array(a.length);
  let n = 0;
  for (let s of a) {
    if (res.includes(s)) {
      console.log(`filterDuplicates: found duplicate '${s}'`);
      continue;
    }
    res[n++] = s;
  }
  res.length = n;
  return res;
}

export function stringMatchesParts(s: string, parts: string[]): boolean {
  for (let p of parts) {
    if (s.indexOf(p) === -1) {
      return false;
    }
  }
  return true;
}

export function findMatchingItems(items: any[], filter: string, itemKey: string): any[] {
  filter = filter.trim();
  if (filter === "") {
    return items;
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
    if (!stringMatchesParts(item[itemKey], filterParts)) {
      continue;
    }
    res[i++] = item;
  }
  res.length = i;
  return res;
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

export async function getClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    // console.error("Error reading clipboard text:", error);
    return "";
  }
}

export async function hasClipboardPermissions(): Promise<boolean> {
  try {
    const permissionStatus = await navigator.permissions.query({
      // @ts-ignore
      name: "clipboard-read",
    });
    switch (permissionStatus.state) {
      case "granted":
        return true;
      case "denied":
        return false;
      case "prompt":
        return false;
    }
  } catch (error) {
    return false;
  }
}

export function renameLS(oldName: string, newName: string) {
  let s = localStorage.getItem(oldName);
  if (s === null) {
    // doesn't exist
    return;
  }
  localStorage.setItem(newName, s);
  localStorage.removeItem(oldName);
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
  const startOk = startIdx === 0 || /\W/.test(s[startIdx - 1]);
  // Check if the end boundary is the end of the string or a non-word character
  const endOk = endIdx === s.length || /\W/.test(s[endIdx]);

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

export function hilightText(s: string, regexp: RegExp): string {
  // console.log("hilightText:", s, regexp);
  return s.replace(regexp, '<span class="hili">$1</span>');
}

export function copyObj(src: any, keys: string[]): any {
  let res = {};
  for (let k of keys) {
    res[k] = src[k];
  }
  return res;
}

export function pushIfNotExists(arr: any[], item: any) {
  if (!arr.includes(item)) {
    arr.push(item);
  }
}

export function arrayRemove(arr: any[], item: any) {
  let i = arr.indexOf(item);
  if (i >= 0) {
    arr.splice(i, 1);
  }
}

export function isKeyCtrlDelete(ev: KeyboardEvent): boolean {
  return (ev.key === "Delete" || ev.key === "Backspace") && ev.ctrlKey;
}

export function isKeyCtrlEnter(ev: KeyboardEvent): boolean {
  return ev.key === "Enter" && ev.ctrlKey;
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
