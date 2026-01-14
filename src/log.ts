import { getNotesCount } from "./notes";
import { getSessionDurationInMs } from "./state";
import { throwIf } from "./util";

export function logEvent(o: Object): void {
  fetch("/api/le", {
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

export function logAppOpen(): void {
  let notesCount = getNotesCount();
  let e = {
    name: "appOpen",
    notesCount: notesCount,
  };
  logEvent(e);
}

export function logAppExit(): void {
  let e = {
    name: "appExit",
    notesCount: getNotesCount,
    sessionDurMs: getSessionDurationInMs(),
  };
  logEvent(e);
}

export function logAskAI(model: string, apiProvider: string): void {
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

function validateNoteOp(op: string): void {
  throwIf(!validOps.includes(op), `invalid op: ${op}`);
}

export function logNoteOp(op: string): void {
  validateNoteOp(op);
  let e = {
    name: op,
  };
  logEvent(e);
}

// TODO: don't log in production unless a debugging enabled
export function warn(...args: any[]): void {
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
