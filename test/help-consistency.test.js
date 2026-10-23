import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import commands from "../src/commands/registry.js";

const readmePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "README.md"
);

describe("[A5] consistência README.md <-> registry", () => {
  it("README deve conter heading '### millbody <name>' para cada comando do registry", async () => {
    const readmeContent = await fs.readFile(readmePath, "utf8");
    for (const cmd of commands) {
      const heading = `### millbody ${cmd.name}`;
      assert.ok(
        readmeContent.includes(heading),
        `README não contém heading "${heading}"`
      );
    }
  });

  it("cada heading '### millbody <cmd>' do README deve existir no registry", async () => {
    const readmeContent = await fs.readFile(readmePath, "utf8");
    const headingPattern = /^### millbody (\S+)$/gm;
    const names = commands.map((c) => c.name);
    const aliases = commands.flatMap((c) => c.aliases);
    let match;
    while ((match = headingPattern.exec(readmeContent)) !== null) {
      const cmdName = match[1];
      assert.ok(
        names.includes(cmdName) || aliases.includes(cmdName),
        `Heading "### millbody ${cmdName}" do README não existe no registry`
      );
    }
  });

  it("cada flag do registry deve aparecer na seção do README do seu comando", async () => {
    const readmeContent = await fs.readFile(readmePath, "utf8");
    for (const cmd of commands) {
      for (const flag of cmd.flags) {
        const flagName = flag.flags.split(",")[0].trim();
        assert.ok(
          readmeContent.includes(flagName),
          `Flag "${flagName}" do comando "${cmd.name}" não encontrada no README`
        );
      }
    }
  });
});
