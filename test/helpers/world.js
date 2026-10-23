import { mock } from "node:test";
import { EventEmitter } from "node:events";

export function installExecMock() {
  const exec = mock.fn((command) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => child.emit("exit", 0));
    return child;
  });
  mock.module("node:child_process", { namedExports: { exec } });

  return {
    exec,
    reset() {
      exec.mock.resetCalls();
    },
    commands() {
      return exec.mock.calls.map((call) => call.arguments[0]);
    },
  };
}

export function installProcMock(responses = {}) {
  const makeFakeChild = (exitCode = 0, stderrOutput = "") => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (stderrOutput) child.stderr.emit("data", stderrOutput);
      child.emit("close", exitCode, null);
    });
    return child;
  };

  const execFile = mock.fn((...args) => {
    const bin = args[0];
    const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
    const response = responses[bin];
    if (response === undefined) {
      const err = new Error(`deny-all: execFile("${bin}") not scripted`);
      if (callback) {
        setImmediate(() => callback(err, "", ""));
        return;
      }
      return Promise.reject(err);
    }
    const { stdout = "", stderr = "", exitCode = 0, error = null } = typeof response === "function" ? response(...args) : response;
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
  });

  const spawn = mock.fn((cmd, spawnArgs = [], opts = {}) => {
    const key = cmd;
    const response = responses[key];
    if (response === undefined) {
      const child = makeFakeChild(1);
      setImmediate(() => {
        const err = new Error(`deny-all: spawn("${cmd}") not scripted`);
        err.code = "ENOENT";
        child.emit("error", err);
      });
      return child;
    }
    const { exitCode = 0, signal = null, error = null } = typeof response === "function" ? response(cmd, spawnArgs, opts) : response;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (error) child.emit("error", error);
      else child.emit("close", exitCode, signal);
    });
    return child;
  });

  const spawnSync = mock.fn((cmd, spawnArgs = [], opts = {}) => {
    const response = responses[cmd];
    if (response === undefined) {
      return { status: 1, stdout: "", stderr: "", error: new Error(`deny-all: spawnSync("${cmd}") not scripted`) };
    }
    const { exitCode = 0, stdout = "", stderr = "" } = typeof response === "function" ? response(cmd, spawnArgs, opts) : response;
    return { status: exitCode, stdout, stderr, error: null };
  });

  mock.module("node:child_process", {
    namedExports: {
      exec: mock.fn(() => { throw new Error("deny-all: exec not scripted"); }),
      execFile,
      spawn,
      spawnSync,
    },
  });

  return {
    execFile,
    spawn,
    spawnSync,
    reset() {
      execFile.mock.resetCalls();
      spawn.mock.resetCalls();
      spawnSync.mock.resetCalls();
    },
  };
}

const constantsSource = `export const constants = { uri: "https://api.test/" };`;

export const rootProject = {
  "mbCore/Constants.js": constantsSource,
  "mbCore/fastlane/keys/millbody.json": JSON.stringify({ token: "tkn" }),
  "millbodyApp.json": JSON.stringify({ account: "acme" }),
  "mbContent/themes/acme-theme/.keep": "",
};

export const themeProject = {
  "screens/.keep": "",
  "millbodyApp.json": JSON.stringify({ account: "acme" }),
};

export const expoProject = {
  "millbody.json": JSON.stringify({ account: "acme", android: { key: {} } }),
  "app.config.ts": "export default {};",
  "package.json": JSON.stringify({ name: "app-mobile", dependencies: { expo: "~57.0.0" } }),
};

export const expoProjectAppJson = {
  "millbody.json": JSON.stringify({ account: "acme" }),
  "app.json": JSON.stringify({ expo: { name: "app-mobile" } }),
  "package.json": JSON.stringify({ name: "app-mobile", dependencies: { expo: "~57.0.0" } }),
};

export const ambiguousProject = {
  "millbody.json": JSON.stringify({ account: "acme" }),
  "app.config.ts": "export default {};",
  "mbCore/Constants.js": constantsSource,
  "millbodyApp.json": JSON.stringify({ account: "acme" }),
};

export const legacyThemeProject = {
  "screens/.keep": "",
  "millbodyApp.json": JSON.stringify({ account: "acme" }),
};

export function mockFetch(payload) {
  const implementation =
    typeof payload === "function"
      ? payload
      : async () => ({
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => payload,
        });
  return mock.method(globalThis, "fetch", implementation);
}
