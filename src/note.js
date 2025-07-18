import { nanoid } from "./nanoid";
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
  /** @type {number} */
  createdAt;
  /** @type {number} */
  updatedAt;

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

  /**
   * @param {string} [id]
   * @param {string} [name]
   */
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  currContentVersionId() {
    return this.versionIds[this.versionIds.length - 1];
  }
}

const kNoteIdLen = 4;
const kNoteCotentIdLen = 4;

/**
 * @returns {string}
 */
export function mkRandomNoteId() {
  return nanoid(kNoteIdLen);
}

/**
 * @param {string} noteID
 * @returns {string}
 */
export function mkRandomContentId(noteID) {
  return noteID + ":" + nanoid(kNoteCotentIdLen);
}

/**
 * @param {string} verId
 */
export function noteIdFromVerId(verId) {
  let idx = verId.indexOf(":");
  if (idx < 0) {
    throw new Error("invalid contentId: " + verId);
  }
  return verId.substring(0, idx);
}
