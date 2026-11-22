import { kEdnaEncrFileExt, kTabHome } from "./constants";
import { toFileName } from "./filenamify";

// most file systems limit a file name to 255 bytes
const kMaxFileNameLen = 255;

/**
 * Rules for a note name (docs/state-machines.md U2). Returns "" if `name` is a
 * valid name for a new note, otherwise a (plain text) reason why it isn't.
 * Doesn't check if a note with this name already exists.
 */
export function noteNameError(name: string): string {
  if (name.trim() === "") {
    return "name cannot be empty";
  }
  if (name !== name.trim()) {
    return "name cannot start or end with a space";
  }
  // system notes and the Home tab sentinel
  if (name.toLowerCase().startsWith("system:") || name === kTabHome) {
    return `'${name}' is a reserved name`;
  }
  // "foo.encr" would be stored as "foo.encr.edna.txt" which is how encrypted
  // note "foo" is stored
  if (name.toLowerCase().endsWith(".encr")) {
    return "name cannot end with '.encr'";
  }
  // Windows device names are reserved, with any extension
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name)) {
    return `'${name}' is a reserved name`;
  }
  if (toFileName(name + kEdnaEncrFileExt).length > kMaxFileNameLen) {
    return "name is too long";
  }
  return "";
}

export function isValidNoteName(name: string): boolean {
  return noteNameError(name) === "";
}
