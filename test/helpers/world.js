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
