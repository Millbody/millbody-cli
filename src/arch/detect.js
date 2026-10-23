import fs from "node:fs";
import path from "node:path";

export const ARCHS = ["expo", "legacy"];

function hasExpoMarker(projectDir) {
  if (!fs.existsSync(path.join(projectDir, "millbody.json"))) return false;

  if (fs.existsSync(path.join(projectDir, "app.config.ts"))) return true;
  if (fs.existsSync(path.join(projectDir, "app.config.js"))) return true;

  const appJsonPath = path.join(projectDir, "app.json");
  if (fs.existsSync(appJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      if (parsed && typeof parsed === "object" && Object.hasOwn(parsed, "expo")) return true;
    } catch {
      return false;
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

function hasLegacyMarker(projectDir) {
  return (
    fs.existsSync(path.join(projectDir, "mbCore")) ||
    fs.existsSync(path.join(projectDir, "millbodyApp.json"))
  );
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

export function resolveArch({ archFlag, projectDir }) {
  const resolvedDir = path.resolve(projectDir ?? process.cwd());

  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Diretório do projeto não encontrado: ${resolvedDir}`);
  }

  const stat = fs.statSync(resolvedDir);
  if (!stat.isDirectory()) {
    throw new Error(`--project deve ser um diretório, não um arquivo: ${resolvedDir}`);
  }

  if (archFlag !== undefined) {
    const normalized = archFlag.toLowerCase();
    if (!ARCHS.includes(normalized)) {
      throw new Error(
        `Arquitetura inválida: "${archFlag}". Valores válidos: ${ARCHS.join(", ")}`
      );
    }
    return { arch: normalized, projectDir: resolvedDir };
  }

  const { arch } = detectArchitecture(resolvedDir);

  if (!arch) {
    throw new Error(
      `Não foi possível detectar a arquitetura do projeto em: ${resolvedDir}\n` +
        `Use --arch <expo|legacy> para forçar ou verifique se o diretório é um projeto Millbody válido.`
    );
  }

  return { arch, projectDir: resolvedDir };
}
