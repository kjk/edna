export const kTabURL = "url";
export const kTabNote = "note";

export class Tab {
  kind: string;
  value: string;

  constructor(kind: string, value: string) {
    this.kind = kind;
    this.value = value;
  }

  isURL(): boolean {
    return this.kind === kTabURL;
  }
  isNote(): boolean {
    return this.kind === kTabNote;
  }
}

export function parseTab(s: string): Tab {
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
