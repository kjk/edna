import { getNotesCount } from "./notes";
import { getSessionDurationInMs } from "./state";
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
        // console.log("event logged:", o);
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
  };
  logEvent(e);
}

export function logAppExit() {
  let e = {
    name: "appExit",
    notesCount: getNotesCount,
    sessionDurMs: getSessionDurationInMs(),
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

// TODO: don't log in production unless a debugging enabled
export function warn(...args) {
  console.warn(...args);
}

// TODO: this should be logged as an event
// export function error(...args) {
//   console.error(...args);
// }

export let error = console.error;

// export function log(...args) {
//   console.log(...args);
// }

export let log = console.log;
