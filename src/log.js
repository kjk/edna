import { getNotesCount } from "./notes";
import { getSessionDurationInMs, getStats } from "./state";
import { throwIf } from "./util";

/**
 * @param {Object} o
 */
export function logEvent(o) {
  fetch("/event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(o),
  })
    .then((response) => {
      if (!response.ok) {
        console.error("failed to log event:", response.statusText);
      } else {
        console.log("event logged:", o);
      }
    })
    .catch((err) => {
      console.error("failed to log event:", err);
    });
}

export function logAppOpen() {
  let notesCount = getNotesCount();
  let e = {
    name: "appOpen",
    notesCount: notesCount,
    stats: getStats(),
  };
  logEvent(e);
}

export function logAppExit() {
  let e = {
    name: "appExit",
    notesCount: getNotesCount,
    sessionDurMs: getSessionDurationInMs(),
    stats: getStats(),
  };
  logEvent(e);
}

/**
 * @param {string} model
 * @param {string} apiProvider
 */
export function logAskAI(model, apiProvider) {
  let e = {
    name: "askAI",
    model: model,
    apiProvider: apiProvider,
  };
  logEvent(e);
}

const validOps = [
  "noteCreate",
  "noteDelete",
  "noteRename",
  "noteSave",
  "noteFormatBlock",
  "runBlock",
  "runBlockWithBlock",
  "runBlockWithClipboard",
  "runFunction",
  "runFunctionWithSelection",
  ,
];

function validateNoteOp(op) {
  throwIf(!validOps.includes(op), `invalid op: ${op}`);
}

export function logNoteOp(op) {
  validateNoteOp(op);
  let e = {
    name: op,
  };
  logEvent(e);
}
