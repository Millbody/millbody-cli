import { EventEmitter } from "node:events";

export function makeFakeChild({ exitCode = 0, signal = null, stderrOutput = "", error = null } = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (error) {
      child.emit("error", error);
    } else {
      if (stderrOutput) child.stderr.emit("data", stderrOutput);
      child.emit("close", exitCode, signal);
    }
  });
  return child;
}

export function makeSpawnFn(script, exitCode = 0) {
  return (cmd, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => child.emit("close", exitCode, null));
    return child;
  };
}

export function makeExecFileFn(responses = {}) {
  return (...args) => {
    const bin = args[0];
    const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
    const response = responses[bin];

    if (response === undefined) {
      const err = new Error(`deny-all: execFile("${bin}") not scripted in processFake`);
      if (callback) {
        setImmediate(() => callback(err, "", ""));
        return;
      }
      return Promise.reject(err);
    }

    const resolved = typeof response === "function" ? response(...args) : response;
    const { stdout = "", stderr = "", error = null } = resolved;

    if (callback) {
      setImmediate(() => {
        if (error) callback(error, stdout, stderr);
        else callback(null, stdout, stderr);
      });
      return;
    }
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      });
    });
  };
}
