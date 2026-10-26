import { execFileSync, execFile as nodeExecFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

export function makeHermeticEnv(root) {
  return {
    PATH: process.env.PATH,
    HOME: root,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_TERMINAL_PROMPT: "0",
    GIT_CEILING_DIRECTORIES: path.dirname(root),
  };
}

export function makeHermeticExecFile(env) {
  return (file, args, opts, cb) =>
    nodeExecFile(file, args, { ...opts, env: { ...env } }, cb);
}

export function makeOriginAndClone() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "millbody-gitrepo-")));
  const tmpRoot = fs.realpathSync(os.tmpdir());
  const origin = path.join(root, "origin.git");
  const clone = path.join(root, "clone");
  assert.ok(root.startsWith(tmpRoot));
  const env = makeHermeticEnv(root);

  const run = (cwd, ...args) =>
    execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();

  fs.mkdirSync(origin);
  run(origin, "init", "--bare", "-b", "main");
  fs.mkdirSync(clone);
  run(clone, "-c", "commit.gpgsign=false", "init", "-b", "main");
  run(clone, "config", "commit.gpgsign", "false");
  run(clone, "remote", "add", "origin", origin);
  fs.writeFileSync(path.join(clone, "README.md"), "init\n");
  run(clone, "add", ".");
  run(clone, "commit", "-m", "initial");
  run(clone, "push", "-u", "origin", "main");

  return {
    root,
    origin,
    clone,
    env,
    git: (...args) => run(clone, ...args),
    gitIn: run,
    execFile: makeHermeticExecFile(env),
    commitFile(name, content = name) {
      fs.writeFileSync(path.join(clone, name), content);
      run(clone, "add", name);
      run(clone, "commit", "-m", `add ${name}`);
      return run(clone, "rev-parse", "HEAD");
    },
    pushMainFromOther(name) {
      const other = path.join(root, `other-${name}`);
      run(root, "clone", origin, other);
      run(other, "config", "commit.gpgsign", "false");
      fs.writeFileSync(path.join(other, name), name);
      run(other, "add", name);
      run(other, "commit", "-m", `other ${name}`);
      run(other, "push", "origin", "main");
      return run(other, "rev-parse", "HEAD");
    },
    cleanup() {
      if (root.startsWith(tmpRoot) && path.basename(root).startsWith("millbody-gitrepo-")) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  };
}
