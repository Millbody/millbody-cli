import { describe, it } from "node:test";
import assert from "node:assert/strict";
import commands from "../src/commands/registry.js";
import { findCommand } from "../src/help.js";
import { defaultHandlers } from "../src/cli.js";

describe("[registry] estrutura do registro de comandos", () => {
  it("deve exportar um array não vazio de descritores de comando", () => {
    assert.ok(Array.isArray(commands));
    assert.ok(commands.length > 0);
  });

  it("deve conter os comandos esperados (legacy + expo + utilitários)", () => {
    const names = commands.map((c) => c.name);
    const required = [
      "build-android",
      "codepush",
      "create",
      "run-android",
      "run-ios",
      "start",
      "test",
      "update-apk",
      "doctor",
      "setup",
    ];
    for (const name of required) {
      assert.ok(names.includes(name), `Comando "${name}" ausente no registry`);
    }
  });

  it("update-apk deve ter alias updateapp", () => {
    const updateApk = commands.find((c) => c.name === "update-apk");
    assert.ok(updateApk);
    assert.deepEqual(updateApk.aliases, ["updateapp"]);
  });

  it("cada descritor deve ter os campos obrigatórios", () => {
    const required = [
      "name",
      "aliases",
      "summary",
      "usage",
      "description",
      "flags",
      "examples",
      "prerequisites",
      "external",
      "sideEffects",
      "interactive",
    ];
    for (const cmd of commands) {
      for (const field of required) {
        assert.ok(field in cmd, `Campo "${field}" ausente em "${cmd.name}"`);
      }
    }
  });

  it("cada descritor deve ter o campo archs com valores válidos", () => {
    const validArchs = ["expo", "legacy"];
    for (const cmd of commands) {
      assert.ok(
        Array.isArray(cmd.archs) && cmd.archs.length > 0,
        `Campo "archs" ausente ou vazio em "${cmd.name}"`
      );
      for (const arch of cmd.archs) {
        assert.ok(validArchs.includes(arch), `Arch inválida "${arch}" em "${cmd.name}"`);
      }
    }
  });

  it("comandos interativos devem incluir: start, run-ios, run-android, codepush, create", () => {
    const interactiveNames = commands.filter((c) => c.interactive).map((c) => c.name);
    const expected = ["start", "run-ios", "run-android", "codepush", "create"];
    for (const name of expected) {
      assert.ok(interactiveNames.includes(name), `Comando interativo "${name}" ausente`);
    }
  });

  it("doctor e setup não devem ser interativos (são utilitários)", () => {
    const doctor = commands.find((c) => c.name === "doctor");
    const setup = commands.find((c) => c.name === "setup");
    assert.ok(doctor, "doctor deve existir no registry");
    assert.ok(setup, "setup deve existir no registry");
    assert.strictEqual(doctor.interactive, false, "doctor não deve ser interativo");
  });
});

describe("[findCommand]", () => {
  it("deve encontrar um comando pelo nome exato", () => {
    const cmd = findCommand("start");
    assert.ok(cmd);
    assert.strictEqual(cmd.name, "start");
  });

  it("deve encontrar um comando pelo alias", () => {
    const cmd = findCommand("updateapp");
    assert.ok(cmd);
    assert.strictEqual(cmd.name, "update-apk");
  });

  it("deve retornar undefined para nome desconhecido", () => {
    assert.strictEqual(findCommand("inexistente"), undefined);
  });

  it("deve retornar undefined para nome vazio", () => {
    assert.strictEqual(findCommand(""), undefined);
  });

  it("deve funcionar com registry customizado", () => {
    const customRegistry = [{ name: "foo", aliases: ["bar"] }];
    assert.strictEqual(findCommand("foo", customRegistry).name, "foo");
    assert.strictEqual(findCommand("bar", customRegistry).name, "foo");
    assert.strictEqual(findCommand("baz", customRegistry), undefined);
  });
});

describe("[A2] paridade registry <-> defaultHandlers", () => {
  it("todo comando no defaultHandlers deve estar no registry", () => {
    const fromRegistry = new Set(commands.flatMap((c) => [c.name, ...c.aliases]));
    const fromHandlers = Object.keys(defaultHandlers);
    for (const key of fromHandlers) {
      assert.ok(fromRegistry.has(key), `"${key}" do defaultHandlers não está no registry`);
    }
  });

  it("comandos utilitários (doctor, setup) devem existir no registry e no defaultHandlers", () => {
    const registryNames = new Set(commands.map((c) => c.name));
    assert.ok(registryNames.has("doctor"), "doctor deve estar no registry");
    assert.ok(registryNames.has("setup"), "setup deve estar no registry");
    assert.ok(Object.hasOwn(defaultHandlers, "doctor"), "doctor deve estar no defaultHandlers");
    assert.ok(Object.hasOwn(defaultHandlers, "setup"), "setup deve estar no defaultHandlers");
  });
});
