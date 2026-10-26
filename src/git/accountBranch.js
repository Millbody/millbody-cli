import { realpath } from "node:fs/promises";
import { proc } from "../arch/proc.js";

export const ACCOUNT_REGEX = /^[a-z0-9][a-z0-9_-]*$/i;

const GIT_OPTS = {
  shell: false,
  env: {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
  },
  timeout: 60000,
  maxBuffer: 10 * 1024 * 1024,
};

function makeGitRunner(projectDir, execFile) {
  return function git(args) {
    return new Promise((resolve) => {
      execFile("git", ["-C", projectDir, ...args], GIT_OPTS, (err, stdout, stderr) => {
        if (err && err.code === "ENOENT") {
          resolve({ ok: false, code: "ENOENT", stdout: "", stderr: "" });
          return;
        }
        const code = err ? (err.code ?? 1) : 0;
        const ok = code === 0;
        resolve({ ok, code, stdout: stdout ?? "", stderr: stderr ?? "" });
      });
    });
  };
}

function firstLine(str) {
  return str.trim().split("\n")[0] ?? "";
}

async function checkRefExists(git, ref) {
  const result = await git(["rev-parse", "--verify", "--quiet", ref]);
  if (result.code === "ENOENT") throw new Error("git não encontrado. Instale git.");
  if (result.code === 0) return true;
  if (result.code === 1) return false;
  throw new Error(firstLine(result.stderr) || `Erro ao verificar ref ${ref}.`);
}

export async function prepareAccountBranch({
  projectDir,
  account,
  baseBranch = "main",
  execFile = proc.execFile,
  log = console.log,
}) {
  if (!ACCOUNT_REGEX.test(account)) {
    throw new Error(
      `Conta inválida: "${account}". Use apenas letras, números, hifens e underscores (deve começar com letra ou número).`
    );
  }

  const git = makeGitRunner(projectDir, execFile);

  const insideResult = await git(["rev-parse", "--is-inside-work-tree"]);
  if (insideResult.code === "ENOENT") throw new Error("git não encontrado. Instale git.");
  if (!insideResult.ok || insideResult.stdout.trim() !== "true") {
    throw new Error(`${projectDir} não é um repositório git.`);
  }

  const toplevelResult = await git(["rev-parse", "--show-toplevel"]);
  if (!toplevelResult.ok) {
    throw new Error(`${projectDir} não é um repositório git.`);
  }
  const [resolvedTop, resolvedProject] = await Promise.all([
    realpath(toplevelResult.stdout.trim()),
    realpath(projectDir),
  ]);
  if (resolvedTop !== resolvedProject) {
    throw new Error(
      `O diretório não é a raiz do repositório git (toplevel: ${resolvedTop}).`
    );
  }

  const statusResult = await git(["status", "--porcelain", "--untracked-files=no"]);
  if (!statusResult.ok) {
    throw new Error(firstLine(statusResult.stderr) || "Erro ao verificar status do repositório.");
  }
  if (statusResult.stdout.trim()) {
    throw new Error(
      `Working tree com mudanças não commitadas. Faça commit ou stash antes de continuar:\n${statusResult.stdout.trim()}`
    );
  }

  const fetchResult = await git([
    "fetch",
    "origin",
    `+refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`,
  ]);
  if (!fetchResult.ok) {
    const detail = firstLine(fetchResult.stderr);
    throw new Error(
      `Não foi possível buscar origin/${baseBranch} (remoto ausente, offline ou ref inexistente): ${detail}`
    );
  }

  const baseRemoteExists = await checkRefExists(git, `refs/remotes/origin/${baseBranch}`);
  if (!baseRemoteExists) {
    throw new Error(
      `A branch ${baseBranch} não existe no remoto origin. Crie origin/${baseBranch} ou use uma versão anterior do CLI.`
    );
  }

  const lsRemoteResult = await git(["ls-remote", "--heads", "origin", `accounts/${account}`]);
  if (lsRemoteResult.code === "ENOENT") throw new Error("git não encontrado. Instale git.");
  const remoteAccountExists = Boolean(lsRemoteResult.stdout.trim());
  if (remoteAccountExists) {
    await git([
      "fetch",
      "origin",
      `+refs/heads/accounts/${account}:refs/remotes/origin/accounts/${account}`,
    ]);
  }

  const branch = `accounts/${account}`;
  let mode;

  const localExists = await checkRefExists(git, `refs/heads/${branch}`);
  const remoteTrackingExists = await checkRefExists(git, `refs/remotes/origin/${branch}`);

  if (localExists) {
    const switchResult = await git(["switch", branch]);
    if (!switchResult.ok) {
      throw new Error(`Falha ao trocar para ${branch}: ${firstLine(switchResult.stderr)}`);
    }
    mode = "local";
    const divergeResult = await git([
      "rev-list",
      "--left-right",
      "--count",
      `origin/${baseBranch}...${branch}`,
    ]);
    const diverge = divergeResult.stdout.trim();
    const [ahead = "0", behind = "0"] = diverge.split("\t");
    log(`Reaproveitando branch local ${branch} (origin/${baseBranch}: +${ahead}/-${behind}).`);
  } else if (remoteTrackingExists) {
    const switchResult = await git(["switch", "-c", branch, "--track", `origin/${branch}`]);
    if (!switchResult.ok) {
      throw new Error(`Falha ao trocar para ${branch}: ${firstLine(switchResult.stderr)}`);
    }
    mode = "remote";
    log(`Branch ${branch} criada rastreando origin/${branch}.`);
  } else {
    const switchResult = await git([
      "switch",
      "-c",
      branch,
      "--no-track",
      `origin/${baseBranch}`,
    ]);
    if (!switchResult.ok) {
      throw new Error(`Falha ao trocar para ${branch}: ${firstLine(switchResult.stderr)}`);
    }
    mode = "new";
    log(`Branch ${branch} criada a partir de origin/${baseBranch}.`);
  }

  return { branch, mode };
}
