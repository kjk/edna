import { nanoid } from "./nanoid";
import { throwIf } from "./util";

// convert falsy values to undefined so that JSON serialization
// doesn't include them, making the JSON smaller and easier to read
function toUndef(v: any): any {
  return v ? v : undefined;
}

export class Note {
  id: string;
  name: string;
  isArchived: boolean;
  isStarred: boolean;
  altShortcut: string;

  // those are transient i.e. not saved in metadata
  versionIds: string[] = [];
  createdAt: number;
  updatedAt: number;

  isDeleted: boolean;

  getMetadata() {
    // by using toUndef() we make JSON-serialized version
    // smaller and easier to read

    // keys must match validNoteMetaKeys in store.go
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
  applyMetadata(m: any): void {
    throwIf(this.id != m.id, "id mismatch");
    this.name = m.name;
    this.isArchived = m.isArchived;
    this.isStarred = m.isStarred;
    this.altShortcut = m.altShortcut;
  }

  constructor(id?: string, name?: string) {
    this.id = id;
    this.name = name;
  }

  currContentVersionId(): string {
    return this.versionIds[this.versionIds.length - 1];
  }
}

// same as in store.go
const kNoteIdLen = 4;
const kNoteCotentIdLen = 4;

export function mkRandomNoteId(): string {
  return nanoid(kNoteIdLen);
}

export function mkRandomContentId(noteID: string): string {
  return noteID + ":" + nanoid(kNoteCotentIdLen);
}

export function parseNoteIdFromVerId(verId: string): string | null {
  if (verId.length !== kNoteIdLen + kNoteCotentIdLen + 1) {
    return null;
  }
  let idx = verId.indexOf(":");
  if (idx != 4) {
    return null;
  }
  return verId.substring(0, idx);
}
