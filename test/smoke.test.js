import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const srcModules = [
  "../src/functions.js",
  "../src/services/api.js",
  "../src/commands/start.js",
  "../src/commands/test.js",
  "../src/commands/codepush.js",
  "../src/commands/runAndroid.js",
  "../src/commands/buildAndroid.js",
  "../src/commands/runIos.js",
  "../src/commands/create.js",
  "../src/commands/updateApk.js",
  "../src/commands/registry.js",
  "../src/help.js",
];

const allJsFiles = [
  "src/functions.js",
  "src/services/api.js",
  "src/commands/start.js",
  "src/commands/test.js",
  "src/commands/codepush.js",
  "src/commands/runAndroid.js",
  "src/commands/buildAndroid.js",
  "src/commands/runIos.js",
  "src/commands/create.js",
  "src/commands/updateApk.js",
  "src/commands/registry.js",
  "src/help.js",
  "src/cli.js",
  "bin/millbody",
];

function spawnWithTimeout(cmd, args, opts, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts);
    let stdout = "";
    let stderr = "";

    if (child.stdout) child.stdout.on("data", (d) => { stdout += d.toString(); });
    if (child.stderr) child.stderr.on("data", (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Processo excedeu timeout de ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe("[smoke] Carregamento de módulos src/**", () => {
  for (const modulePath of srcModules) {
    it(`deve importar ${modulePath} sem erros`, async () => {
      await assert.doesNotReject(
        () => import(modulePath),
        `Falha ao importar ${modulePath}`
      );
    });
  }
});

describe("[smoke] node --check em todos os arquivos .js", () => {
  for (const file of allJsFiles) {
    it(`node --check deve passar em ${file}`, async () => {
      const result = await spawnWithTimeout(
        "node",
        ["--check", path.join(rootDir, file)],
        { stdio: ["ignore", "pipe", "pipe"] },
        5000
      );
      assert.strictEqual(
        result.code,
        0,
        `node --check falhou em ${file}:\n${result.stderr}`
      );
    });
  }
});

describe("[smoke] bin/millbody — comando inexistente", () => {
  it("deve encerrar sem ERR_MODULE_NOT_FOUND ao receber comando inexistente", async () => {
    const result = await spawnWithTimeout(
      "node",
      [path.join(rootDir, "bin/millbody"), "nonexistent-cmd-xyz"],
      { stdio: ["ignore", "pipe", "pipe"] },
      5000
    );

    assert.ok(
      !result.stderr.includes("ERR_MODULE_NOT_FOUND"),
      `stderr não deve conter ERR_MODULE_NOT_FOUND:\n${result.stderr}`
    );
    assert.strictEqual(
      result.code,
      1,
      `exit code deve ser 1 para comando inexistente, recebeu ${result.code}`
    );
  });
});

describe("[smoke] bin/millbody — sem template (stdin fechado)", () => {
  it("deve encerrar sem travar e sem ERR_IMPORT_ATTRIBUTE_MISSING", async () => {
    const result = await spawnWithTimeout(
      "node",
      [path.join(rootDir, "bin/millbody")],
      { stdio: ["ignore", "pipe", "pipe"] },
      5000
    );

    assert.ok(
      !result.stderr.includes("ERR_IMPORT_ATTRIBUTE_MISSING"),
      `stderr não deve conter ERR_IMPORT_ATTRIBUTE_MISSING:\n${result.stderr}`
    );

    assert.ok(
      result.code !== null,
      "o processo deve ter encerrado (não travado)"
    );
  });
});
