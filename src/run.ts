import { ensureStringEndsWithNL, len } from "./util";

export interface CapturingEval {
  output: any;
  exception: string | null;
  consoleLogs: string[];
}

interface GoEvalEvent {
  Message: string;
  Kind: string; // stdout or stderr
  Delay: number;
}

interface GoEvalResult {
  Body: string;
  Events: GoEvalEvent[];
  Error?: string;
  Errors?: string;
}

function getError(res: GoEvalResult): string {
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

export async function runGo(code: string): Promise<CapturingEval> {
  const uri = "/api/goplay/compile";
  let res: CapturingEval = {
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
  } catch (e: unknown) {
    res.exception = e instanceof Error ? e.message : String(e);
    return res;
  }

  if (!rsp.ok) {
    res.exception = `Error: bad HTTP status ${rsp.status} ${rsp.statusText}`;
    return res;
  }
  const rspJSON: GoEvalResult = await rsp.json();
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

async function evalWithConsoleCapture(code: string): Promise<CapturingEval> {
  const consoleLogs: string[] = [];
  function logFn(...args: unknown[]) {
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
    let eval2 = [eval][0]!;
    output = await eval2(code);
  } catch (e: unknown) {
    exception = e instanceof Error ? e.message : String(e);
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

export function evalResultToString(res: CapturingEval): string {
  let resTxt = res.exception || `${res.output}`;
  if (len(res.consoleLogs) > 0) {
    resTxt = ensureStringEndsWithNL(resTxt);
    resTxt += "console output:\n";
    resTxt += res.consoleLogs.join("\n");
  }
  // console.log(res.consoleLogs);
  return resTxt;
}

export async function runJS(code: string): Promise<CapturingEval> {
  return await evalWithConsoleCapture(code);
}

export async function runJSWithArg(code: string, arg: string): Promise<CapturingEval> {
  let qarg = JSON.stringify(arg);
  code = code + "\n" + `main(${qarg})`;
  // console.log("code:", code);
  return evalWithConsoleCapture(code);
}
