import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { hasBinary, javaMajor, hasAndroidSdk, hasXcode } from "../src/requirements/detect.js";
import { makeExecFileFn } from "./helpers/processFake.js";

const sep = path.delimiter;

describe("[requirements/detect] hasBinary — varredura de PATH (não command -v)", () => {
  it("encontra o binário em um diretório do PATH", () => {
    const env = { PATH: ["/usr/bin", "/bin"].join(sep) };
    const existsSync = (p) => p === path.join("/usr/bin", "git");
    assert.equal(hasBinary("git", { env, existsSync }), true);
  });

  it("retorna false quando o binário não está em nenhum diretório", () => {
    const env = { PATH: "/usr/bin" };
    const existsSync = () => false;
    assert.equal(hasBinary("fastlane", { env, existsSync }), false);
  });

  it("considera extraPaths e os diretórios do Homebrew para brew", () => {
    const env = { PATH: "" };
    const existsSync = (p) => p === "/opt/homebrew/bin/brew";
    assert.equal(hasBinary("brew", { env, existsSync, extraPaths: ["/opt/homebrew/bin", "/usr/local/bin"] }), true);
  });

  it("inclui /usr/local/bin mesmo sem extraPaths", () => {
    const env = { PATH: "" };
    const existsSync = (p) => p === "/usr/local/bin/watchman";
    assert.equal(hasBinary("watchman", { env, existsSync }), true);
  });

  it("sobrevive a existsSync que lança em algum diretório", () => {
    const env = { PATH: ["/a", "/b"].join(sep) };
    const existsSync = (p) => {
      if (p === path.join("/a", "pod")) throw new Error("EACCES");
      return p === path.join("/b", "pod");
    };
    assert.equal(hasBinary("pod", { env, existsSync }), true);
  });

  it("não quebra quando PATH é indefinido", () => {
    const existsSync = () => false;
    assert.equal(hasBinary("git", { env: {}, existsSync }), false);
  });
});

describe("[requirements/detect] javaMajor — lê stderr e java_home", () => {
  it("resolve a major via /usr/libexec/java_home (JDK 17)", async () => {
    const execFile = makeExecFileFn({
      "/usr/libexec/java_home": { stdout: "/jdk17home\n" },
      [path.join("/jdk17home", "bin", "java")]: { stderr: 'openjdk version "17.0.2" 2024' },
    });
    assert.equal(await javaMajor({ execFile }), 17);
  });

  it("interpreta versão antiga 1.8 lendo stderr do java direto", async () => {
    const execFile = makeExecFileFn({
      "/usr/libexec/java_home": { error: new Error("no jdk 17") },
      java: { stderr: 'java version "1.8.0_292"' },
    });
    assert.equal(await javaMajor({ execFile }), 8);
  });

  it("retorna null quando java não está instalado (deny-all)", async () => {
    const execFile = makeExecFileFn({});
    assert.equal(await javaMajor({ execFile }), null);
  });

  it("cai para java direto quando java_home é keg-only (stdout vazio)", async () => {
    const execFile = makeExecFileFn({
      "/usr/libexec/java_home": { stdout: "   " },
      java: { stderr: 'openjdk version "21.0.1"' },
    });
    assert.equal(await javaMajor({ execFile }), 21);
  });

  it("cai para java direto quando o java do java_home falha", async () => {
    const execFile = makeExecFileFn({
      "/usr/libexec/java_home": { stdout: "/h" },
      [path.join("/h", "bin", "java")]: { error: new Error("corrompido") },
      java: { stderr: 'openjdk version "17"' },
    });
    assert.equal(await javaMajor({ execFile }), 17);
  });

  it("retorna null quando o stderr não tem padrão de versão", async () => {
    const execFile = makeExecFileFn({
      "/usr/libexec/java_home": { error: new Error("x") },
      java: { stderr: "sem versão aqui" },
    });
    assert.equal(await javaMajor({ execFile }), null);
  });
});

describe("[requirements/detect] hasAndroidSdk", () => {
  it("true quando ANDROID_HOME existe no disco", () => {
    const existsSync = (p) => p === "/android";
    assert.equal(hasAndroidSdk({ env: { ANDROID_HOME: "/android" }, existsSync }), true);
  });

  it("usa ANDROID_SDK_ROOT como fallback", () => {
    const existsSync = (p) => p === "/sdk";
    assert.equal(hasAndroidSdk({ env: { ANDROID_SDK_ROOT: "/sdk" }, existsSync }), true);
  });

  it("false quando nenhuma variável está definida", () => {
    assert.equal(hasAndroidSdk({ env: {}, existsSync: () => true }), false);
  });

  it("false quando a variável aponta para diretório inexistente", () => {
    assert.equal(hasAndroidSdk({ env: { ANDROID_HOME: "/x" }, existsSync: () => false }), false);
  });
});

describe("[requirements/detect] hasXcode", () => {
  it("true quando xcode-select -p retorna um caminho", async () => {
    const execFile = makeExecFileFn({ "xcode-select": { stdout: "/Applications/Xcode.app/Contents/Developer\n" } });
    assert.equal(await hasXcode({ execFile }), true);
  });

  it("false quando xcode-select falha", async () => {
    const execFile = makeExecFileFn({ "xcode-select": { error: new Error("not found") } });
    assert.equal(await hasXcode({ execFile }), false);
  });

  it("false quando xcode-select retorna saída vazia", async () => {
    const execFile = makeExecFileFn({ "xcode-select": { stdout: "   " } });
    assert.equal(await hasXcode({ execFile }), false);
  });
});
