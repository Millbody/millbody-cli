import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createSandbox } from "./helpers/sandbox.js";

let currentChild;
const exec = mock.fn((command) => {
  currentChild = new EventEmitter();
  currentChild.stdout = new EventEmitter();
  currentChild.stderr = new EventEmitter();
  currentChild.command = command;
  return currentChild;
});
mock.module("node:child_process", { namedExports: { exec } });

const { executeCommand, checkFolderBySource } = await import(
  "../src/functions.js"
);

const tick = () => new Promise((resolve) => setImmediate(resolve));
const timeoutSentinel = Symbol("pending");
const settleOrPending = (promise, ms = 30) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(timeoutSentinel), ms)),
  ]);

describe("[functions] executeCommand", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = mock.method(console, "log", () => {});
  });

  afterEach(() => {
    logSpy.mock.restore();
    exec.mock.resetCalls();
  });

  it("deve delegar o comando ao child_process.exec", async () => {
    const promise = executeCommand("echo oi");
    await tick();
    currentChild.emit("exit", 0);
    await promise;
    assert.equal(exec.mock.calls.length, 1);
    assert.deepEqual(exec.mock.calls[0].arguments, ["echo oi"]);
  });

  it("deve resolver com o código de saída 0", async () => {
    const promise = executeCommand("true");
    await tick();
    currentChild.emit("exit", 0);
    assert.equal(await promise, 0);
  });

  it("deve repassar stdout e stderr ao console", async () => {
    const promise = executeCommand("cmd");
    await tick();
    currentChild.stdout.emit("data", Buffer.from("saida"));
    currentChild.stderr.emit("data", Buffer.from("erro"));
    currentChild.emit("exit", 0);
    await promise;
    const logged = logSpy.mock.calls.map((c) => c.arguments[0]);
    assert.ok(logged.includes("saida"));
    assert.ok(logged.includes("erro"));
  });

  it("deve registrar o código de saída no console", async () => {
    const promise = executeCommand("cmd");
    await tick();
    currentChild.emit("exit", 3);
    await promise;
    assert.ok(logSpy.mock.calls.some((c) => c.arguments[0] === "3"));
  });

  it("deve resolver com null quando o processo é terminado por sinal", async () => {
    const promise = executeCommand("cmd");
    await tick();
    currentChild.emit("exit", null);
    assert.equal(await promise, null);
  });

  it("deve resolver com código diferente de zero (comportamento atual)", async () => {
    const promise = executeCommand("falha");
    await tick();
    currentChild.emit("exit", 2);
    assert.equal(await promise, 2);
  });

  it(
    "deve rejeitar quando o processo termina com código diferente de zero",
    { todo: "BUG: executeCommand resolve com código != 0 em vez de rejeitar" },
    async () => {
      const promise = executeCommand("falha");
      await tick();
      currentChild.emit("exit", 2);
      await assert.rejects(promise);
    }
  );

  it(
    "deve rejeitar quando o processo emite o evento error",
    { todo: "BUG: executeCommand não trata o evento 'error' do processo" },
    async () => {
      const promise = executeCommand("inexistente");
      await tick();
      try {
        currentChild.emit("error", new Error("spawn falhou"));
      } catch {}
      const result = await settleOrPending(promise.then(() => "resolved"));
      assert.notEqual(result, timeoutSentinel);
      await assert.rejects(promise);
    }
  );
});

describe("[functions] checkFolderBySource", () => {
  const sandbox = createSandbox("millbody-functions-");
  let errorSpy;
  let exitSpy;

  beforeEach(() => {
    errorSpy = mock.method(console, "error", () => {});
    exitSpy = mock.method(process, "exit", () => {});
  });

  afterEach(() => {
    sandbox.leave();
    errorSpy.mock.restore();
    exitSpy.mock.restore();
  });

  it('deve retornar "theme" com screens e millbodyApp.json', () => {
    sandbox.enter({ "screens/.keep": "", "millbodyApp.json": "{}" });
    assert.equal(checkFolderBySource("theme"), "theme");
    assert.equal(exitSpy.mock.calls.length, 0);
  });

  it('deve retornar "root" com mbCore e millbodyApp.json', () => {
    sandbox.enter({ "mbCore/.keep": "", "millbodyApp.json": "{}" });
    assert.equal(checkFolderBySource("root"), "root");
    assert.equal(exitSpy.mock.calls.length, 0);
  });

  it("deve tratar qualquer source diferente de theme como root", () => {
    sandbox.enter({ "mbCore/.keep": "", "millbodyApp.json": "{}" });
    assert.equal(checkFolderBySource(undefined), "root");
  });

  it("deve lançar erro quando theme não tem screens", () => {
    sandbox.enter({ "millbodyApp.json": "{}" });
    assert.throws(() => checkFolderBySource("theme"), /TEMA MILLBODY/);
  });

  it("deve lançar erro quando theme não tem millbodyApp.json", () => {
    sandbox.enter({ "screens/.keep": "" });
    assert.throws(() => checkFolderBySource("theme"));
  });

  it("deve lançar erro quando root não tem mbCore", () => {
    sandbox.enter({ "millbodyApp.json": "{}" });
    assert.throws(() => checkFolderBySource("root"), /framework MILLBODY APP/);
  });

  it("deve lançar erro quando root não tem millbodyApp.json", () => {
    sandbox.enter({ "mbCore/.keep": "" });
    assert.throws(() => checkFolderBySource("root"));
  });

  it("deve lançar erro em pasta vazia inválida", () => {
    sandbox.enter({});
    assert.throws(() => checkFolderBySource("root"), /framework MILLBODY APP/);
  });
});
