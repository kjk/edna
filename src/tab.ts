export const kTabURL = "url";
export const kTabNote = "note";

export class Tab {
  /** @type {string} */
  kind;
  /** @type {string} */
  value;

  /**
   * @param {string} kind
   * @param {string} value
   */
  constructor(kind, value) {
    this.kind = kind;
    this.value = value;
  }

  isURL() {
    return this.kind === kTabURL;
  }
  isNote() {
    return this.kind === kTabNote;
  }
}

/**
 * @param {string} s
 */
export function parseTab(s) {
  let kind, value;
  if (s.startsWith("url:")) {
    kind = "url";
    value = s.substring(4);
  } else {
    kind = "note";
    value = s;
  }
  return new Tab(kind, value);
}
