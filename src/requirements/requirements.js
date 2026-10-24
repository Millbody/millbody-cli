import { hasBinary, javaMajor, hasAndroidSdk, hasXcode } from "./detect.js";
import { ARCHS } from "../arch/detect.js";

export const requirements = [
  {
    key: "git",
    name: "git",
    archs: ["expo", "legacy"],
    required: true,
    bundled: false,
    detect: async (deps) => hasBinary("git", deps),
    autoInstall: { method: "brew", formula: "git" },
    autoInstallable: true,
    manualInstruction: "Instale as Command Line Tools: xcode-select --install",
  },
  {
    key: "homebrew",
    name: "Homebrew",
    archs: ["expo", "legacy"],
    required: true,
    bundled: false,
    detect: async (deps) => hasBinary("brew", deps),
    autoInstall: null,
    autoInstallable: false,
    manualInstruction: "Instale o Homebrew: https://brew.sh",
  },
  {
    key: "yarn",
    name: "yarn (1.x)",
    archs: ["expo"],
    required: true,
    bundled: false,
    detect: async (deps) => hasBinary("yarn", deps),
    autoInstall: { method: "corepack", formula: "yarn" },
    autoInstallable: true,
    manualInstruction: "Execute: corepack enable && corepack prepare yarn@1.22.22 --activate",
  },
  {
    key: "watchman",
    name: "watchman",
    archs: ["expo"],
    required: true,
    bundled: false,
    detect: async (deps) => hasBinary("watchman", deps),
    autoInstall: { method: "brew", formula: "watchman" },
    autoInstallable: true,
    manualInstruction: "Execute: brew install watchman",
  },
  {
    key: "cocoapods",
    name: "CocoaPods",
    archs: ["expo"],
    required: true,
    bundled: false,
    detect: async (deps) => hasBinary("pod", deps),
    autoInstall: { method: "brew", formula: "cocoapods" },
    autoInstallable: true,
    manualInstruction: "Execute: brew install cocoapods",
  },
  {
    key: "jdk17",
    name: "JDK 17",
    archs: ["expo", "legacy"],
    required: true,
    bundled: false,
    detect: async (deps) => {
      const major = await javaMajor(deps);
      return major !== null && major >= 17;
    },
    autoInstall: { method: "brew-cask", formula: "openjdk@17" },
    autoInstallable: true,
    manualInstruction: "Execute: brew install openjdk@17 && export JAVA_HOME=$(/usr/libexec/java_home -v 17)",
  },
  {
    key: "fastlane",
    name: "fastlane",
    archs: ["legacy"],
    required: true,
    bundled: false,
    detect: async (deps) => hasBinary("fastlane", deps),
    autoInstall: { method: "brew", formula: "fastlane" },
    autoInstallable: true,
    manualInstruction: "Execute: brew install fastlane",
  },
  {
    key: "ttab",
    name: "ttab",
    archs: ["expo", "legacy"],
    required: true,
    bundled: true,
    detect: async (deps) => {
      const { existsSync, ttabPath } = deps;
      if (ttabPath) return existsSync(ttabPath);
      return false;
    },
    autoInstall: null,
    autoInstallable: false,
    manualInstruction: "ttab é instalado junto com o CLI: npm install -g @millbody/millbody-cli",
  },
  {
    key: "xcode",
    name: "Xcode + CLT",
    archs: ["expo", "legacy"],
    required: true,
    bundled: false,
    detect: async (deps) => hasXcode(deps),
    autoInstall: null,
    autoInstallable: false,
    manualInstruction: "Instale o Xcode pela App Store e execute: xcode-select --install",
  },
  {
    key: "android-sdk",
    name: "Android SDK / adb",
    archs: ["expo", "legacy"],
    required: true,
    bundled: false,
    detect: async (deps) => hasAndroidSdk(deps),
    autoInstall: null,
    autoInstallable: false,
    manualInstruction: "Instale o Android Studio: https://developer.android.com/studio",
  },
];

export function requirementsFor(arch) {
  return requirements.filter((req) => req.archs.includes(arch));
}

export function requirementsForAll() {
  const seen = new Set();
  const result = [];
  for (const arch of ARCHS) {
    for (const req of requirementsFor(arch)) {
      if (!seen.has(req.key)) {
        seen.add(req.key);
        result.push(req);
      }
    }
  }
  return result;
}

export async function evaluateRequirements({ arch, reqs, deps }) {
  const applicable = reqs !== undefined ? reqs : requirementsFor(arch);
  const results = await Promise.all(
    applicable.map(async (req) => {
      let ok = false;
      let detail = "";
      try {
        ok = await req.detect(deps);
      } catch (err) {
        ok = false;
        detail = err.message;
      }
      return { req, ok, detail };
    })
  );
  return results;
}
