import { throwIf } from "./util";

// convert falsy values to undefined so that JSON serialization
// doesn't include them, making the JSON smaller and easier to read
function toUndef(v) {
  return v ? v : undefined;
}

export class Note {
  /** @type {string} */
  id;
  /** @type {string} */
  name;
  /** @type {string[]} */
  versionIds = [];
  /** @type {boolean} */
  isArchived;
  /** @type {boolean} */
  isStarred;
  /** @type {string}  */
  altShortcut;

  getMetadata() {
    // by using toUndef() we make JSON-serialized version
    // smaller and easier to read
    return {
      id: this.id,
      name: this.name,
      isArchived: toUndef(this.isArchived),
      isStarred: toUndef(this.isStarred),
      altShortcut: toUndef(this.altShortcut),
    };
  }

  // reverse of getMetadata()
  // note that if a field in m is missing, it's false / undefined
  applyMetadata(m) {
    throwIf(this.id != m.id, "id mismatch");
    this.name = m.name;
    this.isArchived = m.isArchived;
    this.isStarred = m.isStarred;
    this.altShortcut = m.altShortcut;
  }

  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
}
