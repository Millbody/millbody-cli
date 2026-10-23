import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  parseArgumentsIntoOptions,
  promptForMissingOptions,
  cli,
} from "../src/cli.js";

describe("[cli] parseArgumentsIntoOptions", () => {
  it('deve retornar template "start" quando args contém "start"', () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "start"]);
    assert.strictEqual(result.template, "start");
  });

  it('deve retornar template "test" quando args contém "test"', () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "test"]);
    assert.strictEqual(result.template, "test");
  });

  it("deve extrair --account quando fornecido", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "start",
      "--account",
      "my-org",
    ]);
    assert.strictEqual(result.account, "my-org");
  });

  it("deve extrair --account via alias -a", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "start",
      "-a",
      "my-org",
    ]);
    assert.strictEqual(result.account, "my-org");
  });

  it("deve extrair --source root e retornar source = root", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "start",
      "--source",
      "root",
    ]);
    assert.strictEqual(result.source, "root");
  });

  it("deve retornar source = theme quando --source não é root", () => {
    const result = parseArgumentsIntoOptions(["node", "bin", "start"]);
    assert.strictEqual(result.source, "theme");
  });

  it("deve retornar template undefined quando nenhum comando é passado", () => {
    const result = parseArgumentsIntoOptions(["node", "bin"]);
    assert.strictEqual(result.template, undefined);
  });

  it("deve extrair --track quando fornecido", () => {
    const result = parseArgumentsIntoOptions([
      "node",
      "bin",
      "codepush",
      "--track",
      "production",
    ]);
    assert.strictEqual(result.track, "production");
  });
});

describe("[cli] promptForMissingOptions", () => {
  it('deve retornar options inalteradas quando template já está definido', async () => {
    const options = { template: "test", source: "theme" };
    const result = await promptForMissingOptions(options);
    assert.strictEqual(result.template, "test");
  });

  it('deve retornar template "start" quando template é undefined e stdin não é TTY', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    try {
      const result = await promptForMissingOptions({ template: undefined });
      assert.strictEqual(result.template, "start");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });

  it('deve retornar template "start" quando stdin.isTTY é false', async () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    try {
      const result = await promptForMissingOptions({ template: undefined, source: "theme" });
      assert.strictEqual(result.template, "start");
      assert.strictEqual(result.source, "theme");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });
});

describe("[cli] roteamento com handlers injetáveis", () => {
  it("deve chamar o handler correto quando template é start", async () => {
    const startHandler = mock.fn(async () => "started");
    const handlers = { start: startHandler };

    await cli(["node", "bin", "start"], handlers);

    assert.strictEqual(startHandler.mock.calls.length, 1);
    const [calledOptions] = startHandler.mock.calls[0].arguments;
    assert.strictEqual(calledOptions.template, "start");
  });

  it("deve chamar o handler correto quando template é test", async () => {
    const testHandler = mock.fn(async () => "tested");
    const handlers = { test: testHandler };

    await cli(["node", "bin", "test"], handlers);

    assert.strictEqual(testHandler.mock.calls.length, 1);
  });

  it("não deve lançar quando o template não tem handler correspondente", async () => {
    const handlers = {};
    await assert.doesNotReject(
      () => cli(["node", "bin", "nonexistent-cmd-xyz"], handlers)
    );
  });

  it("deve passar account e track para o handler", async () => {
    const handler = mock.fn(async () => {});
    const handlers = { start: handler };

    await cli(
      ["node", "bin", "start", "--account", "test-org", "--track", "prod"],
      handlers
    );

    assert.strictEqual(handler.mock.calls.length, 1);
    const [options] = handler.mock.calls[0].arguments;
    assert.strictEqual(options.account, "test-org");
    assert.strictEqual(options.track, "prod");
  });
});
