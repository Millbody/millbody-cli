import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requirements,
  requirementsFor,
  evaluateRequirements,
} from "../src/requirements/requirements.js";
import { makeExecFileFn } from "./helpers/processFake.js";

describe("[requirements] SSOT", () => {
  it("exporta um array não vazio com os campos obrigatórios", () => {
    assert.ok(Array.isArray(requirements) && requirements.length > 0);
    for (const req of requirements) {
      for (const field of ["key", "name", "archs", "required", "detect", "autoInstallable", "manualInstruction"]) {
        assert.ok(field in req, `campo "${field}" ausente em "${req.key}"`);
      }
      assert.equal(typeof req.detect, "function");
      assert.ok(Array.isArray(req.archs) && req.archs.length > 0);
    }
  });

  it("chaves são únicas", () => {
    const keys = requirements.map((r) => r.key);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe("[requirements] requirementsFor", () => {
  it("expo inclui yarn/watchman/cocoapods e exclui fastlane", () => {
    const keys = requirementsFor("expo").map((r) => r.key);
    for (const k of ["yarn", "watchman", "cocoapods"]) assert.ok(keys.includes(k));
    assert.ok(!keys.includes("fastlane"));
  });

  it("legacy inclui fastlane e exclui yarn/watchman/cocoapods", () => {
    const keys = requirementsFor("legacy").map((r) => r.key);
    assert.ok(keys.includes("fastlane"));
    for (const k of ["yarn", "watchman", "cocoapods"]) assert.ok(!keys.includes(k));
  });

  it("git, homebrew, jdk17, ttab, xcode e android-sdk estão em ambas as arquiteturas", () => {
    const expo = new Set(requirementsFor("expo").map((r) => r.key));
    const legacy = new Set(requirementsFor("legacy").map((r) => r.key));
    for (const k of ["git", "homebrew", "jdk17", "ttab", "xcode", "android-sdk"]) {
      assert.ok(expo.has(k) && legacy.has(k), `"${k}" deveria estar em ambas`);
    }
  });

  it("ttab é bundled e não auto-instalável", () => {
    const ttab = requirements.find((r) => r.key === "ttab");
    assert.equal(ttab.bundled, true);
    assert.equal(ttab.autoInstallable, false);
  });

  it("homebrew não é auto-instalável (exige interação)", () => {
    const brew = requirements.find((r) => r.key === "homebrew");
    assert.equal(brew.autoInstallable, false);
    assert.equal(brew.autoInstall, null);
  });
});

describe("[requirements] evaluateRequirements", () => {
  it("avalia todos os requisitos como satisfeitos quando os detectores passam (expo)", async () => {
    const deps = {
      execFile: makeExecFileFn({
        "/usr/libexec/java_home": { stdout: "/j" },
        "/j/bin/java": { stderr: 'openjdk version "17"' },
        "xcode-select": { stdout: "/dev" },
      }),
      existsSync: () => true,
      env: { PATH: "/usr/bin", ANDROID_HOME: "/android" },
      ttabPath: "/ttab/bin/ttab",
    };
    const results = await evaluateRequirements({ arch: "expo", deps });
    assert.equal(results.length, requirementsFor("expo").length);
    for (const { req, ok } of results) {
      assert.equal(ok, true, `${req.key} deveria estar ok`);
    }
  });

  it("um detector que lança não derruba a tabela (isolamento M5)", async () => {
    const deps = {
      execFile: makeExecFileFn({}),
      existsSync: () => {
        throw new Error("boom disk");
      },
      env: {},
      ttabPath: "/x/ttab",
    };
    const results = await evaluateRequirements({ arch: "legacy", deps });
    assert.equal(results.length, requirementsFor("legacy").length);
    const ttab = results.find((r) => r.req.key === "ttab");
    assert.equal(ttab.ok, false);
    assert.match(ttab.detail, /boom disk/);
    for (const { ok } of results) assert.equal(ok, false);
  });

  it("marca ok:false quando ttab não é resolvido (ttabPath ausente)", async () => {
    const deps = {
      execFile: makeExecFileFn({}),
      existsSync: () => false,
      env: {},
      ttabPath: null,
    };
    const results = await evaluateRequirements({ arch: "expo", deps });
    const ttab = results.find((r) => r.req.key === "ttab");
    assert.equal(ttab.ok, false);
  });
});
