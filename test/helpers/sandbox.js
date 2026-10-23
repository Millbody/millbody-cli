import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createSandbox(prefix = "millbody-sandbox-") {
  const originalCwd = process.cwd();
  let dir;

  return {
    enter(files = {}) {
      dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
      for (const [name, content] of Object.entries(files)) {
        const target = path.join(dir, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (content === null) {
          fs.mkdirSync(target, { recursive: true });
        } else {
          fs.writeFileSync(target, content, "utf8");
        }
      }
      process.chdir(dir);
      return dir;
    },
    leave() {
      process.chdir(originalCwd);
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
      dir = undefined;
    },
  };
}

export async function waitFor(predicate, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor excedeu o timeout");
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}
