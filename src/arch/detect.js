import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const ARCHS = ["expo", "legacy"];

export const MARKERS = {
  expo: {
    required: ["millbody.json"],
    oneOf: ["app.config.ts", "app.config.js", "app.json[expo-key]", "package.json[expo-dep]"],
  },
  legacy: {
    any: ["mbCore/", "millbodyApp.json"],
  },
  theme: {
    all: ["screens/", "millbodyApp.json"],
  },
  root: {
    all: ["mbCore/", "millbodyApp.json"],
  },
};

export function hasExpoMarker(projectDir) {
  if (!fs.existsSync(path.join(projectDir, "millbody.json"))) return false;

  if (fs.existsSync(path.join(projectDir, "app.config.ts"))) return true;
  if (fs.existsSync(path.join(projectDir, "app.config.js"))) return true;

  const appJsonPath = path.join(projectDir, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      if (parsed && typeof parsed === "object" && Object.hasOwn(parsed, "expo")) return true;
    } catch {
      // corrupted app.json — fall through to package.json check (T1.1b / EC07)
    }
  }

  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg?.dependencies?.expo || pkg?.devDependencies?.expo) return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function hasLegacyMarker(projectDir) {
  return (
    fs.existsSync(path.join(projectDir, "mbCore")) ||
    fs.existsSync(path.join(projectDir, "millbodyApp.json"))
  );
}

export function hasThemeMarkers(projectDir) {
  return (
    fs.existsSync(path.join(projectDir, "screens")) &&
    fs.existsSync(path.join(projectDir, "millbodyApp.json"))
  );
}

export function hasRootMarkers(projectDir) {
  return (
    fs.existsSync(path.join(projectDir, "mbCore")) &&
    fs.existsSync(path.join(projectDir, "millbodyApp.json"))
  );
}

export function describeExpectedMarkers(archFlag) {
  if (archFlag === "expo") {
    return "millbody.json + (app.config.ts | app.config.js | app.json{expo} | package.json{expo-dep})";
  }
  if (archFlag === "legacy") {
    return "mbCore/ ou millbodyApp.json";
  }
  if (archFlag === "theme") {
    return "screens/ e millbodyApp.json";
  }
  if (archFlag === "root") {
    return "mbCore/ e millbodyApp.json";
  }
  return "expo: millbody.json + app config; legacy: mbCore/ ou millbodyApp.json";
}

export function detectArchitecture(projectDir) {
  const expo = hasExpoMarker(projectDir);
  const legacy = hasLegacyMarker(projectDir);

  if (expo && legacy) {
    return { arch: "expo", reason: "expo-marker-takes-precedence", ambiguous: true };
  }
  if (expo) {
    return { arch: "expo", reason: "expo-marker-found", ambiguous: false };
  }
  if (legacy) {
    return { arch: "legacy", reason: "legacy-marker-found", ambiguous: false };
  }
  return { arch: null, reason: "no-marker-found", ambiguous: false };
}

function resolveHome(home) {
  if (!home) {
    try {
      return fs.realpathSync(os.homedir());
    } catch {
      return os.homedir();
    }
  }
  try {
    return fs.realpathSync(home);
  } catch {
    return home;
  }
}

export function walkUp(startDir, predicate, { home } = {}) {
  const resolvedHome = resolveHome(home);

  let current;
  try {
    current = fs.realpathSync(startDir);
  } catch {
    return { dir: null, searched: [] };
  }

  const searched = [];

  while (true) {
    searched.push(current);

    let matches = false;
    try {
      matches = predicate(current);
    } catch {
      matches = false;
    }

    if (matches) {
      return { dir: current, searched };
    }

    const parent = path.dirname(current);

    if (parent === current) break;
    if (current === resolvedHome) break;

    current = parent;
  }

  return { dir: null, searched };
}

function formatSearchedDirs(searched) {
  if (searched.length <= 3) return searched.join(", ");
  return `${searched[0]}, ...(${searched.length - 2} intermediários)..., ${searched[searched.length - 1]}`;
}

export function findProjectRoot({ startDir, archFlag, home } = {}) {
  const resolvedStart = startDir
    ? path.resolve(startDir)
    : process.cwd();

  if (!fs.existsSync(resolvedStart)) {
    throw new Error(`Diretório do projeto não encontrado: ${resolvedStart}`);
  }

  const stat = fs.statSync(resolvedStart);
  if (!stat.isDirectory()) {
    throw new Error(`--project deve ser um diretório, não um arquivo: ${resolvedStart}`);
  }

  let predicate;
  if (archFlag !== undefined) {
    const normalized = archFlag.toLowerCase();
    if (!ARCHS.includes(normalized)) {
      throw new Error(
        `Arquitetura inválida: "${archFlag}". Valores válidos: ${ARCHS.join(", ")}`
      );
    }
    predicate = normalized === "expo" ? hasExpoMarker : hasLegacyMarker;
  } else {
    predicate = (dir) => hasExpoMarker(dir) || hasLegacyMarker(dir);
  }

  const { dir, searched } = walkUp(resolvedStart, predicate, { home });

  if (!dir) {
    const searchedStr = formatSearchedDirs(searched);
    const markersDesc = describeExpectedMarkers(archFlag);
    throw new Error(
      `Projeto Millbody não encontrado a partir de: ${resolvedStart}\n` +
      `Diretórios buscados: ${searchedStr}\n` +
      `Marcadores esperados: ${markersDesc}\n` +
      `Use --arch <expo|legacy> para forçar ou --project para apontar para o projeto.`
    );
  }

  const { arch, reason, ambiguous } = detectArchitecture(dir);
  const resolvedArch = archFlag ? archFlag.toLowerCase() : arch;

  return {
    projectDir: dir,
    arch: resolvedArch,
    reason,
    ambiguous,
    startDir: resolvedStart,
    searched,
  };
}

export function resolveArch({ archFlag, projectDir, home } = {}) {
  const startDir = projectDir !== undefined ? path.resolve(projectDir) : undefined;

  if (startDir !== undefined) {
    if (!fs.existsSync(startDir)) {
      throw new Error(`Diretório do projeto não encontrado: ${startDir}`);
    }
    const stat = fs.statSync(startDir);
    if (!stat.isDirectory()) {
      throw new Error(`--project deve ser um diretório, não um arquivo: ${startDir}`);
    }
  }

  const { arch, projectDir: resolvedProjectDir } = findProjectRoot({
    startDir: startDir ?? process.cwd(),
    archFlag,
    home,
  });

  return { arch, projectDir: resolvedProjectDir };
}
