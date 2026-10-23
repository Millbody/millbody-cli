# Agent Memory — workflow-orchestrator

## Padrões do Projeto
- `@millbody/millbody-cli`: CLI Node.js ESM (`"type": "module"`), pequeno (~15 arquivos .js + `bin/millbody` sem extensão). Entrypoint real é `bin/millbody` → `src/cli.js` → `src/commands/*.js` (cada comando é `default export`).
- `src/services/api.js` resolve módulos/arquivos do PROJETO CONSUMIDOR (`process.cwd()/mbCore/...`), que NÃO existem neste repo — por isso testes usam fixtures em tmpdir e `rootFolder` injetável em `getAppAccount(account, rootFolder = process.cwd())`.
- `functions.js::executeCommand` usa `exec` (shell) — interpola args direto no shell (risco de injection, fora de escopo hoje).
- Dois lockfiles coexistem (`package-lock.json` + `yarn.lock`); histórico git os atualiza juntos.

## Decisões Arquiteturais
- JSON no Node 23: preferir `fs.promises.readFile` + `JSON.parse` (com remoção de BOM) em vez de import attributes — mais portável e mockável.
- Import de caminho absoluto no ESM: usar `pathToFileURL`; para extensionless, tentar candidatos (`X.js`, `X/index.js`) e capturar `ERR_MODULE_NOT_FOUND` só do próprio path (Node 23 usa caminhos posix, não `file://`, nas mensagens — checar ambos).
- Prompt: inquirer 14 NÃO tem `type:"list"` (lança `UnknownPromptTypeError`). Usar `select` de `@inquirer/prompts` e remover o pacote `inquirer`. Em não-TTY, não abrir prompt (`!process.stdin.isTTY` → default).
- Testabilidade sem mock de módulo ESM: exportar funções puras (`parseArgumentsIntoOptions`, `promptForMissingOptions`) e aceitar handlers injetáveis (`cli(args, handlers)`).
- `bin` deve ter `.catch` (exit code; `ExitPromptError` → 130), senão erros viram unhandled rejection.

## Erros Recorrentes & Soluções
- `ERR_IMPORT_ATTRIBUTE_MISSING` ao importar JSON no Node 23 → ler via fs.
- `ERR_MODULE_NOT_FOUND` em import extensionless → pathToFileURL + candidatos.
- `node --check` NÃO detecta imports quebrados — complementar com smoke de carga via `import()` de cada módulo.
- `node --test` sem dir explícito pode varrer `tasks/`/`node_modules` — usar `node --test test/`.

## Aprendizados de QA
- QA pode sinalizar os trailers de atribuição como "violação"; quando a atribuição é EXIGIDA pela config do ambiente/instrução do usuário, NÃO é defeito — não reescrever histórico.
- Trivy `fs .` escaneia os DOIS lockfiles e DOBRA a contagem. Para número real, escanear cada lockfile isolado (copiar `package.json` + um lockfile para dir separado). Baseline real = 38/lockfile.
- Vuln pode vir de transitiva profunda (CVE-2026-44705 `tmp` via `@inquirer/prompts → external-editor → tmp`) — corrigir com `overrides` (npm) + `resolutions` (yarn) `tmp ^0.2.6`.

## Dependências & Integrações
- Removidas: `axios` (fonte da CRITICAL form-data), `node-fetch@2`, `strip-ansi`, `inquirer` (pesado, puxava tmp vulnerável).
- Mantidas: `arg`, `ttab`, `@inquirer/prompts` (direta, p/ `select`).
- fetch nativo do Node 23 NÃO respeita `HTTP(S)_PROXY` (regressão potencial vs axios).
- API externa: ALDERAAN (`{uri}api/alderaan/v1/{account}/app/`) via Bearer token lido de `mbCore/fastlane/keys/millbody.json`.

## Observações
- Trabalho feito na worktree `.worktrees/node23-upgrade` (branch `node23-upgrade`). NÃO fazer merge/push/publish sem aprovação explícita do usuário.
- Resultado da tarefa 001: 46/46 testes, Trivy 0/0, 8 commits. Doc em `docs/001-node23-upgrade.md`.
- Recomendações futuras pendentes: engines `>=23.5.0`+MAJOR bump, injections, executeCommand/spawn, bug lsof, process.exit, consolidar lockfile, eslint config.
