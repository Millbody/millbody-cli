import { describe, it, beforeEach, afterEach, after, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.MILLBODY_SKIP_SETUP = "1";

const { shouldSkip, run } = await import("../scripts/postinstall.js");

const PKG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const created = [];
const persistent = [];

function makeDir(list = created) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-sandbox-postinstall-")));
  list.push(dir);
  return dir;
}

const DARWIN = "darwin";
const base = (over = {}) => ({ npm_config_global: "true", ...over });

afterEach(() => {
  while (created.length) fs.rmSync(created.pop(), { recursive: true, force: true });
});

after(() => {
  while (persistent.length) fs.rmSync(persistent.pop(), { recursive: true, force: true });
  try {
    fs.rmSync(path.join(PKG_DIR, ".millbody-postinstall.log"), { force: true });
  } catch {}
});

describe("[postinstall] shouldSkip — table-driven", () => {
  const pkgDir = makeDir(persistent);
  const otherDir = makeDir(persistent);

  const skipCases = [
    ["MILLBODY_SKIP_SETUP=1", base({ MILLBODY_SKIP_SETUP: "1", INIT_CWD: otherDir }), DARWIN, /MILLBODY_SKIP_SETUP/],
    ["MILLBODY_SKIP_SETUP=true", base({ MILLBODY_SKIP_SETUP: "true", INIT_CWD: otherDir }), DARWIN, /MILLBODY_SKIP_SETUP/],
    ["CI=true", base({ CI: "true", INIT_CWD: otherDir }), DARWIN, /CI/],
    ["GITHUB_ACTIONS", base({ GITHUB_ACTIONS: "true", INIT_CWD: otherDir }), DARWIN, /CI/],
    ["CONTINUOUS_INTEGRATION", base({ CONTINUOUS_INTEGRATION: "1", INIT_CWD: otherDir }), DARWIN, /CI/],
    ["plataforma linux", base({ INIT_CWD: otherDir }), "linux", /plataforma não suportada/],
    ["não global", { INIT_CWD: otherDir }, DARWIN, /não é instalação global/],
    ["dev install (INIT_CWD === pkgDir)", base({ INIT_CWD: pkgDir }), DARWIN, /desenvolvimento/],
    ["INIT_CWD irresolvível", base({ INIT_CWD: "/nao/existe/xyz-123" }), DARWIN, /não foi possível verificar/],
  ];

  for (const [label, env, platform, expected] of skipCases) {
    it(`pula: ${label}`, () => {
      const reason = shouldSkip(env, platform, pkgDir);
      assert.match(reason, expected);
    });
  }

  it("CI=false não aciona skip por CI (cai para checagem global)", () => {
    const reason = shouldSkip({ CI: "false", INIT_CWD: otherDir }, DARWIN, pkgDir);
    assert.match(reason, /não é instalação global/);
  });

  it("pula quando rodando como root (uid 0)", () => {
    const getuidSpy = mock.method(process, "getuid", () => 0);
    try {
      const reason = shouldSkip(base({ INIT_CWD: otherDir }), DARWIN, pkgDir);
      assert.match(reason, /root/);
    } finally {
      getuidSpy.mock.restore();
    }
  });

  it("retorna null quando é instalação global legítima", () => {
    const getuidSpy = mock.method(process, "getuid", () => 501);
    try {
      const reason = shouldSkip(base({ INIT_CWD: otherDir }), DARWIN, pkgDir);
      assert.equal(reason, null);
    } finally {
      getuidSpy.mock.restore();
    }
  });
});

describe("[postinstall] run — sempre resolve, exit 0", () => {
  it("pula setup e não chama runSetup quando shouldSkip retorna razão", async () => {
    const runSetup = mock.fn(async () => {});
    const log = mock.fn();
    const pkgDir = makeDir();
    await run({ env: { MILLBODY_SKIP_SETUP: "1" }, platform: DARWIN, pkgDir, runSetup, log });
    assert.equal(runSetup.mock.calls.length, 0);
    assert.equal(process.exitCode, 0);
  });

  it("executa runSetup não-interativo quando não há skip (sucesso)", async () => {
    const runSetup = mock.fn(async () => {});
    const log = mock.fn();
    const pkgDir = makeDir();
    const otherDir = makeDir();
    await run({
      env: { npm_config_global: "true", INIT_CWD: otherDir },
      platform: DARWIN,
      pkgDir,
      runSetup,
      log,
    });
    assert.equal(runSetup.mock.calls.length, 1);
    const [opts] = runSetup.mock.calls[0].arguments;
    assert.equal(opts.yes, true);
    assert.equal(opts.dryRun, false);
    assert.equal(process.exitCode, 0);
  });

  it("resolve e mantém exit 0 mesmo quando runSetup rejeita (erro/timeout)", async () => {
    const runSetup = mock.fn(async () => {
      throw new Error("brew timeout");
    });
    const log = mock.fn();
    const pkgDir = makeDir();
    const otherDir = makeDir();
    await assert.doesNotReject(
      run({
        env: { npm_config_global: "true", INIT_CWD: otherDir },
        platform: DARWIN,
        pkgDir,
        runSetup,
        log,
      })
    );
    assert.equal(runSetup.mock.calls.length, 1);
    assert.equal(process.exitCode, 0);
  });
});
