import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  installExecMock,
  rootProject,
  themeProject,
  mockFetch,
} from "./helpers/world.js";
import { createSandbox, waitFor } from "./helpers/sandbox.js";

const shell = installExecMock();

const start = (await import("../src/commands/start.js")).default;
const codepush = (await import("../src/commands/codepush.js")).default;
const buildAndroid = (await import("../src/commands/buildAndroid.js")).default;
const runAndroid = (await import("../src/commands/runAndroid.js")).default;
const runIos = (await import("../src/commands/runIos.js")).default;
const testCommand = (await import("../src/commands/test.js")).default;
const create = (await import("../src/commands/create.js")).default;
const updateApk = (await import("../src/commands/updateApk.js")).default;

const sandbox = createSandbox("millbody-sandbox-commands-");
let logSpy;
let errorSpy;
let exitSpy;
let fetchSpy;

beforeEach(() => {
  shell.reset();
  logSpy = mock.method(console, "log", () => {});
  errorSpy = mock.method(console, "error", () => {});
  exitSpy = mock.method(process, "exit", () => {});
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 15));
  fetchSpy?.mock.restore();
  fetchSpy = undefined;
  logSpy.mock.restore();
  errorSpy.mock.restore();
  exitSpy.mock.restore();
  sandbox.leave();
});

const logged = () => logSpy.mock.calls.map((call) => call.arguments[0]);

describe("[commands] comandos simples (theme vs root)", () => {
  const cases = [
    {
      name: "start",
      run: start,
      theme: "cp millbodyApp.json ../../../ && cd ../../../ && npm start --reset-cache",
      root: "npx react-native start --reset-cache",
    },
    {
      name: "codepush",
      run: codepush,
      theme: "cd ../../../ && node ./mbCore/framework/script.js codepush deploy",
      root: "node ./mbCore/framework/script.js codepush deploy",
      message: "publicando pelo CodePush...",
    },
    {
      name: "buildAndroid",
      run: buildAndroid,
      theme: "cd ../../../ && cd android/ && ./gradlew clean && ./gradlew assembleRelease",
      root: "cd android/ && ./gradlew clean && ./gradlew assembleRelease",
      message: "Limpando cache e buildando android...",
    },
    {
      name: "runIos",
      run: runIos,
      theme: "cd ../../../ && react-native run-ios",
      root: "react-native run-ios",
      message: "Rodando aplicação no iOS...",
    },
  ];

  for (const { name, run, theme, root, message } of cases) {
    it(`${name}: deve executar o comando de tema em pasta de tema`, () => {
      sandbox.enter(themeProject);
      run({ source: "theme" });
      assert.deepEqual(shell.commands(), [theme]);
      if (message) assert.ok(logged().includes(message));
      assert.equal(exitSpy.mock.calls.length, 0);
    });

    it(`${name}: deve executar o comando de raiz em pasta raiz`, () => {
      sandbox.enter(rootProject);
      run({ source: "root" });
      assert.deepEqual(shell.commands(), [root]);
      if (message) assert.ok(logged().includes(message));
      assert.equal(exitSpy.mock.calls.length, 0);
    });

    it(`${name}: deve recusar pasta que não é de tema quando source é theme`, () => {
      sandbox.enter(rootProject);
      assert.throws(() => run({ source: "theme" }), /TEMA MILLBODY/);
    });
  }
});

describe("[commands] runAndroid", () => {
  it("deve rodar no tema usando a conta do millbodyApp.json", () => {
    sandbox.enter(themeProject);
    runAndroid({ source: "theme" });
    assert.ok(logged().includes("Rodando APP acme no Android"));
    assert.deepEqual(shell.commands(), [
      "cd ../../../ && cd android/ && ./gradlew clean && cd .. && ENVFILE=.env react-native run-android",
    ]);
  });

  it("deve rodar na raiz", () => {
    sandbox.enter(rootProject);
    runAndroid({ source: "root" });
    assert.deepEqual(shell.commands(), [
      "cd android/ && ./gradlew clean && cd .. && ENVFILE=.env react-native run-android",
    ]);
    assert.ok(logged().includes("Limpando cache e rodando android..."));
  });

  it("deve lançar erro quando millbodyApp.json é inválido", () => {
    sandbox.enter({ ...rootProject, "millbodyApp.json": "{nao-json" });
    assert.throws(() => runAndroid({ source: "root" }), SyntaxError);
    assert.equal(shell.commands().length, 0);
  });
});

describe("[commands] test", () => {
  it("deve avisar e não executar quando index.test.js não existe", () => {
    sandbox.enter(rootProject);
    testCommand({ source: "root" });
    assert.equal(shell.commands().length, 0);
    assert.ok(logged().some((m) => /index\.test\.js não existe/.test(m)));
  });

  it("deve executar com .env.test na raiz quando index.test.js existe", () => {
    sandbox.enter({ ...rootProject, "index.test.js": "" });
    testCommand({ source: "root" });
    assert.deepEqual(shell.commands(), [
      "cd android/ && ./gradlew clean && cd .. && ENVFILE=.env.test react-native run-android",
    ]);
    assert.ok(logged().includes("Limpando cache e rodando android..."));
  });

  it("deve executar com .env.test no tema quando index.test.js existe", () => {
    sandbox.enter({ ...themeProject, "index.test.js": "" });
    testCommand({ source: "theme" });
    assert.deepEqual(shell.commands(), [
      "cd ../../../ && cd android/ && ./gradlew clean && cd .. && ENVFILE=.env.test react-native run-android",
    ]);
  });
});

