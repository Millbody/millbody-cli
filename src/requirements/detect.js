import path from "node:path";
import { proc } from "../arch/proc.js";

export function hasBinary(bin, { env = process.env, existsSync, extraPaths = [] } = {}) {
  const pathDirs = [
    ...(env.PATH ?? "").split(path.delimiter).filter(Boolean),
    ...extraPaths,
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];

  for (const dir of pathDirs) {
    try {
      if (existsSync(path.join(dir, bin))) return true;
    } catch {
      continue;
    }
  }
  return false;
}

function parseJavaMajor(output) {
  const match = output.match(/version\s+"?(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const first = parseInt(match[1], 10);
  if (first === 1) {
    const second = parseInt(match[2] ?? "0", 10);
    return second;
  }
  return first;
}

export async function javaMajor({ execFile = proc.execFile } = {}) {
  const tryJavaHome = () =>
    new Promise((resolve) => {
      execFile("/usr/libexec/java_home", ["-v", "17"], { timeout: 5000 }, (err, stdout) => {
        if (err || !stdout?.trim()) return resolve(null);
        const javaHome = stdout.trim();
        execFile(
          path.join(javaHome, "bin", "java"),
          ["-version"],
          { timeout: 5000 },
          (err2, _stdout2, stderr2) => {
            if (err2) return resolve(null);
            resolve(parseJavaMajor(stderr2 ?? ""));
          }
        );
      });
    });

  const tryJavaDirect = () =>
    new Promise((resolve) => {
      execFile("java", ["-version"], { timeout: 5000 }, (err, _stdout, stderr) => {
        if (err) return resolve(null);
        resolve(parseJavaMajor(stderr ?? ""));
      });
    });

  const fromJavaHome = await tryJavaHome();
  if (fromJavaHome !== null) return fromJavaHome;
  return tryJavaDirect();
}

export function hasAndroidSdk({ env = process.env, existsSync } = {}) {
  const sdkRoot = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdkRoot) return false;
  return existsSync(sdkRoot);
}

export async function hasXcode({ execFile = proc.execFile } = {}) {
  return new Promise((resolve) => {
    execFile("xcode-select", ["-p"], { timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(false);
      resolve(Boolean(stdout?.trim()));
    });
  });
}
