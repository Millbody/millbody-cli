import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { runScript } from "../src/arch/runner.js";
import { makeFakeChild } from "./helpers/processFake.js";

function spawnReturning(opts) {
  return mock.fn(() => makeFakeChild(opts));
}

describe("[arch/runner] runScript", () => {
  it("invoca yarn com array de args, sem shell, cwd e stdio inherit", async () => {
    const spawn = spawnReturning({ exitCode: 0 });
    await runScript("/proj", "start", ["--web"], { spawn });

    assert.equal(spawn.mock.calls.length, 1);
    const [cmd, args, opts] = spawn.mock.calls[0].arguments;
    assert.equal(cmd, "yarn");
    assert.deepEqual(args, ["start", "--web"]);
    assert.equal(opts.cwd, "/proj");
    assert.equal(opts.stdio, "inherit");
    assert.equal(opts.shell, false);
  });

  it("usa array vazio de args por padrão", async () => {
    const spawn = spawnReturning({ exitCode: 0 });
    await runScript("/proj", "ios", undefined, { spawn });
    const [, args] = spawn.mock.calls[0].arguments;
    assert.deepEqual(args, ["ios"]);
  });

  it("propaga o exit code do processo filho", async () => {
    const spawn = spawnReturning({ exitCode: 42 });
    const code = await runScript("/proj", "android", [], { spawn });
    assert.equal(code, 42);
  });

  it("retorna 1 quando o código é null e não há signal", async () => {
    const spawn = mock.fn(() => makeFakeChild({ exitCode: null, signal: null }));
    const code = await runScript("/proj", "start", [], { spawn });
    assert.equal(code, 1);
  });

  it("converte SIGINT em 130 (128+2)", async () => {
    const spawn = mock.fn(() => makeFakeChild({ exitCode: null, signal: "SIGINT" }));
    const code = await runScript("/proj", "start", [], { spawn });
    assert.equal(code, 130);
  });

  it("converte outros sinais em 129 (128+1)", async () => {
    const spawn = mock.fn(() => makeFakeChild({ exitCode: null, signal: "SIGTERM" }));
    const code = await runScript("/proj", "start", [], { spawn });
    assert.equal(code, 129);
  });

  it("rejeita com mensagem clara quando yarn não é encontrado (ENOENT)", async () => {
    const enoent = new Error("spawn yarn ENOENT");
    enoent.code = "ENOENT";
    const spawn = mock.fn(() => makeFakeChild({ error: enoent }));
    await assert.rejects(runScript("/proj", "start", [], { spawn }), /yarn não encontrado/);
  });

  it("propaga outros erros do evento error", async () => {
    const boom = new Error("falha genérica");
    boom.code = "EACCES";
    const spawn = mock.fn(() => makeFakeChild({ error: boom }));
    await assert.rejects(runScript("/proj", "start", [], { spawn }), /falha genérica/);
  });
});
