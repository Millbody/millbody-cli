import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAppAccount } from "../src/services/api.js";

async function makeTmpdir() {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), "millbody-api-test-"));
}

async function writeFile(filePath, content) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, content, "utf8");
}

function makeOkFetch(payload) {
  return async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => payload,
  });
}

function makeFailFetch(status, statusText) {
  return async () => ({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  });
}

afterEach(() => {
  mock.restoreAll();
});

describe("[api] getAppAccount", () => {
  it("deve retornar dados quando Constants.js e millbody.json existem e fetch retorna ok", async () => {
    const tmpdir = await makeTmpdir();
    await writeFile(
      path.join(tmpdir, "mbCore", "Constants.js"),
      `export const constants = { uri: "https://api.example.com/" };`
    );
    await writeFile(
      path.join(tmpdir, "mbCore", "fastlane", "keys", "millbody.json"),
      `{"token": "test-token-123"}`
    );

    const expectedPayload = { appName: "TestApp", bundleId: "com.test.app" };
    mock.method(globalThis, "fetch", makeOkFetch(expectedPayload));

    const result = await getAppAccount("test-account", tmpdir);

    assert.deepEqual(result, expectedPayload);
  });

  it("deve lançar Error com status quando fetch retorna !res.ok (404)", async () => {
    const tmpdir = await makeTmpdir();
    await writeFile(
      path.join(tmpdir, "mbCore", "Constants.js"),
      `export const constants = { uri: "https://api.example.com/" };`
    );
    await writeFile(
      path.join(tmpdir, "mbCore", "fastlane", "keys", "millbody.json"),
      `{"token": "test-token-123"}`
    );

    mock.method(globalThis, "fetch", makeFailFetch(404, "Not Found"));

    await assert.rejects(
      () => getAppAccount("test-account", tmpdir),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("404"),
          `mensagem deve conter 404: ${err.message}`
        );
        return true;
      }
    );
  });

  it("deve lançar Error de rede quando fetch lança TypeError", async () => {
    const tmpdir = await makeTmpdir();
    await writeFile(
      path.join(tmpdir, "mbCore", "Constants.js"),
      `export const constants = { uri: "https://api.example.com/" };`
    );
    await writeFile(
      path.join(tmpdir, "mbCore", "fastlane", "keys", "millbody.json"),
      `{"token": "test-token-123"}`
    );

    const networkError = new TypeError("fetch failed");
    networkError.cause = new Error("ECONNREFUSED");
    mock.method(globalThis, "fetch", async () => {
      throw networkError;
    });

    await assert.rejects(
      () => getAppAccount("test-account", tmpdir),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.toLowerCase().includes("rede") ||
            err.message.includes("ECONNREFUSED") ||
            err.message.includes("fetch"),
          `mensagem deve indicar falha de rede: ${err.message}`
        );
        return true;
      }
    );
  });

  it("deve lançar Error quando diretório mbCore não existe (Constants ausente)", async () => {
    const tmpdir = await makeTmpdir();

    mock.method(globalThis, "fetch", makeOkFetch({}));

    await assert.rejects(
      () => getAppAccount("test-account", tmpdir),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes(tmpdir) || err.message.includes("Constants"),
          `mensagem deve conter o caminho ou 'Constants': ${err.message}`
        );
        return true;
      }
    );
  });

  it("deve lançar Error quando millbody.json está ausente", async () => {
    const tmpdir = await makeTmpdir();
    await writeFile(
      path.join(tmpdir, "mbCore", "Constants.js"),
      `export const constants = { uri: "https://api.example.com/" };`
    );

    mock.method(globalThis, "fetch", makeOkFetch({}));

    await assert.rejects(
      () => getAppAccount("test-account", tmpdir),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("millbody.json"),
          `mensagem deve mencionar millbody.json: ${err.message}`
        );
        return true;
      }
    );
  });

  it("deve lançar SyntaxError quando millbody.json contém JSON inválido", async () => {
    const tmpdir = await makeTmpdir();
    await writeFile(
      path.join(tmpdir, "mbCore", "Constants.js"),
      `export const constants = { uri: "https://api.example.com/" };`
    );
    await writeFile(
      path.join(tmpdir, "mbCore", "fastlane", "keys", "millbody.json"),
      `{ invalid json !!`
    );

    mock.method(globalThis, "fetch", makeOkFetch({}));

    await assert.rejects(
      () => getAppAccount("test-account", tmpdir),
      (err) => {
        assert.ok(
          err instanceof SyntaxError,
          `deve ser SyntaxError, recebeu ${err.constructor.name}`
        );
        return true;
      }
    );
  });

  it("deve usar Constants/index.js como fallback quando Constants.js não existe", async () => {
    const tmpdir = await makeTmpdir();
    await writeFile(
      path.join(tmpdir, "mbCore", "Constants", "index.js"),
      `export const constants = { uri: "https://api.example.com/" };`
    );
    await writeFile(
      path.join(tmpdir, "mbCore", "fastlane", "keys", "millbody.json"),
      `{"token": "fallback-token"}`
    );

    const expectedPayload = { appName: "FallbackApp" };
    mock.method(globalThis, "fetch", makeOkFetch(expectedPayload));

    const result = await getAppAccount("test-account", tmpdir);

    assert.deepEqual(result, expectedPayload);
  });
});
