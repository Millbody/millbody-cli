import { resolveArch } from "../arch/detect.js";
import { evaluateRequirements } from "../requirements/requirements.js";
import { proc } from "../arch/proc.js";
import fs from "node:fs";

export function renderDoctorTable(results) {
  const lines = [""];
  const maxNameLen = Math.max(...results.map((r) => r.req.name.length), 10);

  lines.push(`  ${"Requisito".padEnd(maxNameLen + 2)}  Status  Instrução`);
  lines.push(`  ${"-".repeat(maxNameLen + 2)}  ------  ---------`);

  for (const { req, ok, detail } of results) {
    const status = ok ? "  ✓  " : "  ✗  ";
    const instruction = ok ? "" : req.manualInstruction ?? "";
    const detailSuffix = detail ? ` (${detail})` : "";
    lines.push(`  ${req.name.padEnd(maxNameLen + 2)}${status}  ${instruction}${detailSuffix}`);
  }

  lines.push("");
  return lines.join("\n");
}

export default async function doctor(options, deps = {}) {
  const {
    execFile = proc.execFile,
    existsSync = fs.existsSync,
    env = process.env,
  } = deps;

  const { arch, projectDir } = resolveArch({
    archFlag: options.arch,
    projectDir: options.projectDir ?? options.project,
  });

  console.log(`\nVerificando requisitos para arquitetura: ${arch}`);
  console.log(`Projeto: ${projectDir}\n`);

  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  let ttabPath = null;
  try {
    ttabPath = require.resolve("ttab/bin/ttab");
  } catch {
    try {
      ttabPath = require.resolve("ttab");
    } catch {
      ttabPath = null;
    }
  }

  const results = await evaluateRequirements({
    arch,
    deps: { execFile, existsSync, env, ttabPath },
  });

  console.log(renderDoctorTable(results));

  const missing = results.filter((r) => !r.ok && r.req.required);
  if (missing.length > 0) {
    console.error(
      `Faltam ${missing.length} requisito(s) obrigatório(s): ${missing.map((r) => r.req.name).join(", ")}`
    );
    return 1;
  }

  console.log("Todos os requisitos obrigatórios estão satisfeitos.");
  return 0;
}
