import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { installExecMock, rootProject, mockFetch } from "./helpers/world.js";
import { createSandbox, waitFor } from "./helpers/sandbox.js";

const shell = installExecMock();
const select = mock.fn(async () => "start");
mock.module("@inquirer/prompts", { namedExports: { select } });

const { cli } = await import("../src/cli.js");

const sandbox = createSandbox("millbody-sandbox-regr-");
const argv = (...rest) => ["node", "millbody", ...rest];

let logSpy;
let errorSpy;
let fetchSpy;

beforeEach(() => {
  shell.reset();
  logSpy = mock.method(console, "log", () => {});
  errorSpy = mock.method(console, "error", () => {});
  sandbox.enter(rootProject);
  fetchSpy = mockFetch({ themeName: "acme-theme", account: "acme" });
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 15));
  fetchSpy.mock.restore();
  logSpy.mock.restore();
  errorSpy.mock.restore();
  sandbox.leave();
});

describe("[regressão D2] flags novas não alteram o fluxo legado", () => {
  it("start gera os MESMOS comandos com e sem --arch/--project", async () => {
    await cli(argv("start", "--source", "root"));
    const semFlags = shell.commands();
    assert.match(semFlags[0], /react-native start/);

    shell.reset();
    await cli(argv("start", "--source", "root", "--arch", "legacy", "--project", "."));
    const comFlags = shell.commands();

    assert.deepEqual(comFlags, semFlags);
  });

  it("run-android gera os MESMOS comandos com e sem flags novas", async () => {
    await cli(argv("run-android", "--source", "root"));
    const semFlags = shell.commands();

    shell.reset();
    await cli(argv("run-android", "--source", "root", "--arch", "legacy"));
    const comFlags = shell.commands();

    assert.deepEqual(comFlags, semFlags);
    assert.match(comFlags[0], /react-native run-android/);
  });

  it("create gera a MESMA sequência de comandos com e sem --project", async () => {
    await cli(argv("create", "-a", "acme", "-t", "beta", "--source", "root"));
    await waitFor(() => shell.commands().length === 8);
    const semFlags = shell.commands();

    shell.reset();
    fetchSpy.mock.restore();
    fetchSpy = mockFetch({ themeName: "acme-theme", account: "acme" });
    await cli(argv("create", "-a", "acme", "-t", "beta", "--source", "root", "--project", "."));
    await waitFor(() => shell.commands().length === 8);
    const comFlags = shell.commands();

    assert.deepEqual(comFlags, semFlags);
  });
});
