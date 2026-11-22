import { expect, test } from "vitest";
import { noteNameError } from "./note-name";

// note name rules (docs/state-machines.md U2)
test("noteNameError", () => {
  for (let ok of ["foo", "Foo Bar", "a.b", "encr", "a.encrypted", "edna: my functions", "zażółć", "console"]) {
    expect(noteNameError(ok), ok).toBe("");
  }
  for (let bad of ["", "  ", " foo", "a.encr", "A.ENCR", "system:help", "System:x", "__home:", "con", "LPT1", "x".repeat(300), "ż".repeat(60)]) {
    expect(noteNameError(bad), bad).not.toBe("");
  }
});
