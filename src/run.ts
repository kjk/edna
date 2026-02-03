import { ensureStringEndsWithNL, len } from "./util";

/** @typedef {{
  output: any,
  exception: string,
  consoleLogs: string[],
 }} CapturingEval
*/

/** @typedef {{
   Message: string,
   Kind: string, // stdout or stderr
   Delay: number,
 }} GoEvalEvent */

/** @typedef {{
  Body: string,
  Events: GoEvalEvent[],
  Error?: string,
  Errors?: string,
 }} GoEvalResult */

/**
 *
 * @param {GoEvalResult} res
 * @returns {string}
 */
function getError(res) {
  // TODO: don't get why there are Error and Errors
  // maybe can improve backend code?
  if (res.Error && res.Error !== "") {
    return res.Error;
  }
  if (res.Errors && res.Errors !== "") {
    return res.Errors;
  }
  return "";
}

/**
 * @param {string} code
 * @returns {Promise<CapturingEval>}
 */
export async function runGo(code) {
  const uri = "/api/goplay/compile";
  /** @type {CapturingEval} */
  let res = {
    output: "",
    exception: null,
    consoleLogs: [],
  };
  let rsp;
  try {
    rsp = await fetch(uri, {
      method: "POST",
      body: code,
    });
  } catch (e) {
    res.exception = e.message;
    return res;
  }

  if (!rsp.ok) {
    res.exception = `Error: bad HTTP status ${rsp.status} ${rsp.statusText}`;
    return res;
  }
  /** @type {GoEvalResult} */
  const rspJSON = await rsp.json();
  console.log("rspJSON:", rspJSON);
  const err = getError(rspJSON);
  if (err != "") {
    res.exception = err;
    return res;
  }
  let stdout = [];
  let stderr = [];
  for (const ev of rspJSON.Events) {
    if (ev.Kind === "stderr") {
      stderr.push(ev.Message);
      continue;
    }
    if (ev.Kind === "stdout") {
      stdout.push(ev.Message);
      continue;
    }
  }
  res.output = stdout.join("\n");
  if (len(stderr) > 0) {
    res.output += "stderr:\n" + stderr.join("\n");
  }
  return res;
}

/**
 * returns last returned javascript expression
 * (undefined if there was no expression)
 * @param {string} code
 * @returns {Promise<CapturingEval>}
 */
async function evalWithConsoleCapture(code) {
  /** @type {string[]} */
  const consoleLogs = [];
  function logFn(...args) {
    let all = "";
    for (let arg of args) {
      let s = JSON.stringify(arg);
      if (all != "") {
        all += " ";
      }
      all += s;
    }
    consoleLogs.push(all);
  }
  const originalConsole = console;
  console.log = logFn;
  console.debug = logFn;
  console.warn = logFn;
  console.error = logFn;
  let output = "";
  let exception = null;
  try {
    // hack: obfuscate the use of eval() to disable rollup warning
    let eval2 = [eval][0];
    output = await eval2(code);
  } catch (e) {
    exception = e.message;
  } finally {
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }
  return {
    output,
    exception,
    consoleLogs,
  };
}

/**
 * @param {CapturingEval} res
 * @returns {string}
 */
export function evalResultToString(res) {
  let resTxt = res.exception || `${res.output}`;
  if (len(res.consoleLogs) > 0) {
    resTxt = ensureStringEndsWithNL(resTxt);
    resTxt += "console output:\n";
    resTxt += res.consoleLogs.join("\n");
  }
  // console.log(res.consoleLogs);
  return resTxt;
}

/**
 * @param {string} code
 * @returns {Promise<CapturingEval>}
 */
export async function runJS(code) {
  return await evalWithConsoleCapture(code);
}

/**
 * @param {string} code
 * @param {string} arg
 * @returns {Promise<CapturingEval>}
 */
export async function runJSWithArg(code, arg) {
  let qarg = JSON.stringify(arg);
  code = code + "\n" + `main(${qarg})`;
  // console.log("code:", code);
  return evalWithConsoleCapture(code);
}
