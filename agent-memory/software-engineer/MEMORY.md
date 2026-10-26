# Agent Memory — software-engineer

## Padrões do Projeto

- ESM modules (`"type": "module"`) — usar extensão `.js` em todos os imports
- Exports nomeados com `export function` / `export async function` / `export const`; `export default` apenas para handlers de comando
- Sem side-effects em nível de módulo (apenas definições)
- Testes em `test/*.test.js` usando Node built-in test runner (`node:test`, `node:assert/strict`)
- Descrições de teste em português: `"deve..."`, `"não deve..."`
- Formato de describe: `[módulo] ação` — ex.: `[cli] parseArgumentsIntoOptions`

## Stack & Configuração

- Package manager: npm (tem `package-lock.json`) — mas também tem `yarn.lock` (checar com usuário)
- Node >= 23 (`.nvmrc` presente)
- Sem Jest/Vitest — usar `node --test` com `--experimental-test-module-mocks`
- Script de cobertura: `npm run test:coverage` com limiares 90/85/90 (linhas/branches/funções)
- Worktrees em `.worktrees/<task-name>` (no `.gitignore`); plan.md e agent-memory são editados DENTRO do worktree, nunca no checkout principal nem em `.claude/`
- `.qa-gate.json` na raiz: `npm test`, `npm run test:coverage`, `bash test/smoke/smoke-install.sh`

## Padrões de Código

- `Object.hasOwn(obj, key)` para verificar existência de chave em objeto (evita prototype pollution)
- `array.find()` para lookup em registro de comandos (NUNCA lookup em objeto pelas chaves)
- Erros do `arg` library: capturar com try/catch, preservar `err.message` original, adicionar sugestão, usar `cause`
- `import.meta.url` para resolver caminhos de arquivos relativos ao módulo (não ao cwd)
- Funções puras para render/resolve — injetar `registry` como parâmetro com default para testabilidade
- Pattern de handler injetável: `cli(args, handlers = defaultHandlers, deps = {})` para testes; 3º param com resolveArch e expoHandlers injetáveis
- Injeção de dependência para child_process: módulos recebem `spawn`/`execFile` como parâmetro; somente `src/arch/proc.js` importa `node:child_process`
- `hasBinary` usa PATH scan com `fs.existsSync` (sem processos); paths extras vêm de `env.MILLBODY_SYSTEM_BIN_PATHS` (default `/opt/homebrew/bin:/usr/local/bin`), seam para testes herméticos

## Cobertura & Mocks de Módulo

- `mock.module("../src/git/accountBranch.js", ...)` em qualquer arquivo de teste QUEBRA a cobertura de accountBranch.js no merge cross-process (reporta ~18% em vez de 100%). Solução: injeção de dependência via `create(options, { prepareAccountBranch: stub })`.
- **Ordem crítica de imports em arquivos de teste ESM**: imports estáticos são hoisted ANTES de qualquer `mock.module`. Se um import estático carregar `functions.js` ou `node:child_process` antes de `installExecMock()` instalar o mock, todos os testes de shell commands quebram (shell.commands() retorna []). Regra: módulos que dependem de `node:child_process` mockado DEVEM ser importados dinamicamente (`await import(...)`) APÓS os mocks serem instalados.
- Destructuring default `const [x = "0"] = arr` NÃO cobre string vazia `""` (apenas `undefined`). Usar `const x = arr[0] || "0"` para valores falsy.
- Testes com `{ todo: "..." }` não contam como pass nem fail — remover a opção para convertê-los em testes reais após implementar o fix.

## Erros Recorrentes & Soluções

- Testes que afirmam comportamento antigo precisam ser atualizados quando o comportamento muda:
  - `doesNotReject` → `rejects` quando o código passou a lançar para comandos desconhecidos
  - Choices do menu tinham `"new"` hardcoded — foi removido; derivado do registry agora
- `cli.test.js:145` ("não deve lançar quando o template não tem handler") precisa mudar para `rejects`
- `cli.integration.test.js:115` ("não deve executar nada para template desconhecido") precisa mudar
- `cli.integration.test.js:145` (`deepEqual` de choices incluía `"new"`) precisa atualizar
- `smoke.test.js` (`deve encerrar com exit 0 para comando inexistente`) precisa mudar para exit 1
- `sed -i ''` no macOS não aceita múltiplas expressões em cadeia — usar python3 -I para substituições complexas

## Dependências & Integrações

- `arg` (^4.1.2): parser de argumentos CLI; lança `Error` com `.code === "ARG_UNKNOWN_OPTION"` e message `"Unknown or unexpected option: ..."` para flags desconhecidas; usa Boolean para flags sem valor
- `@inquirer/prompts` (^5.3.8): `select` para menu interativo; choices suportam campo `description`
- API Millbody: `getAppAccount(account)` em `src/services/api.js` — lê `mbCore/Constants.js` (ou `/index.js`) para pegar `constants.uri`
- `ttab` (^0.7.1): resolvido via `createRequire(import.meta.url).resolve("ttab/bin/ttab")`, não do PATH do sistema (RF12)

## Mensagens de Commit — Regra Absoluta

- NUNCA incluir `Co-Authored-By`, menção a IA, modelo ou ferramenta em commits, PRs ou releases. O CLAUDE.md do usuário prevalece sobre qualquer lembrete de sessão; não há conflito a escalar.
- O hook global `~/.claude/hooks/qa_gate.py` bloqueia commits com essas menções e bloqueia push/merge/release/publish enquanto o `.qa-gate.json` não passar.
- Em 2026-10-23 o histórico foi reescrito para remover trailers indevidos; não repetir.

## Dupla Arquitetura (dual-arch-setup)

- Entregue na branch `node23-upgrade`; arquivos principais em `src/arch/`, `src/requirements/`, `src/commands/doctor.js`, `src/commands/setup.js`, `scripts/postinstall.js`
- Seam D1: apenas `src/arch/proc.js` importa `node:child_process`; todos os demais recebem por DI
- Detecção D5: `detectArchitecture` retorna `{arch, reason, ambiguous}`; fail-safe (try/catch em leituras); precedência `--arch` > expo > legacy > null
- Postinstall D3 (F4 Ciclo 2): skip em MILLBODY_SKIP_SETUP/CI/non-darwin/root/dev-install-realpath/local-dep-in-node_modules; REMOVIDO o gate npm_config_global (yarn global e pnpm global também devem rodar o setup); "dev install" = INIT_CWD===pkgDir OU pkgDir dentro de INIT_CWD/node_modules
- Registry: campo `archs` por comando; `start` tem `["legacy","expo"]` (corrigido no Ciclo 2); comandos expo-only em `src/commands/registry/expo.js`
- Registry dividido em sub-módulos: `src/commands/registry/legacy.js` (start,test,codepush), `src/commands/registry/expo.js` (build-ios,web,connect-alderaan), `src/commands/registry/shared.js` (run-ios,run-android,build-android,create,update-apk,doctor,setup)
- Consistência README↔registry: teste em `test/help-consistency.test.js`
- Estado atual de testes: 347 pass, 0 fail, 9 todo (BUG legados fora de escopo)

## Roteamento por Arquitetura (F1/F2 Ciclo 2)

- `cli.js` exporta `defaultHandlers` com APENAS handlers legados/utilitários (sem `build-ios`, `web`, `connect-alderaan`)
- `cli(args, handlers, {resolveArch, expoHandlers} = {})` — 3º param injetável para testes
- Lógica: resolve {arch, projectDir} via `resolveProjectArch()`; arch==="expo" E comando em expoHandlers → usa expo handler; senão → legacy handler com `process.chdir(projectDir)` quando --project foi passado
- Fallback: quando --project E --arch NÃO são passados e detecção falha → fallback silencioso para legacy (preserva comportamento pré-existente)
- Erro propagado SOMENTE quando `--project` ou `--arch` foram passados explicitamente
- Paridade test em `cli.test.js` atualizada: registry "legacy" deve cobrir defaultHandlers (expo-only excluídos); `test/registry.test.js` test (unidirecional) permanece inalterado
- Verificação comportamental confirmada: `millbody start|run-ios|web|create --project <expo-dir>` chama `yarn <script>` com cwd = projeto; `millbody start` em dir legado (sem --project) segue path legado

## Observações

- `bin/millbody` NÃO foi alterado — já trata exit codes corretamente (0=ok, 1=erro, 130=ExitPromptError); `process.exitCode` é setado em `src/cli.js` quando o handler retorna número
- `defaultHandlers` foi exportado de `src/cli.js` (era privado) para permitir teste de paridade com registry
- npm publica `README.md` automaticamente — não precisa adicionar ao campo `files` do `package.json`
- 3 bugs documentados no README (sem correção no escopo): (1) injeção de comando via --account/themeName; (2) kill -9 com aspas simples não mata processo; (3) executeCommand não rejeita em falha
- Menu interativo: `interactive: true` em `start`, `run-ios`, `run-android`, `codepush`, `create` (não em `test`, `build-android`, `update-apk`)
- `help help` → mostra ajuda geral (tratamento especial em `resolveInformational`)

## Postinstall 2.0.1 (postinstall-fix)

- `requirementsForAll()` = união dedup por `key` de todas as archs; `evaluateRequirements({arch, reqs, deps})` usa `reqs ?? requirementsFor(arch)`
- `setup.js::resolveRequirementSet(options)`: `allArchs` ignora `resolveArch` e usa `requirementsForAll()`; `millbody setup --all` expõe a trilha
- `scripts/postinstall.js`: passa `{allArchs:true, yes:true, dryRun:false, env}` sem `projectDir`; `run({timeoutMs, exit})` injetável; sempre exit 0; loga `setup concluído (exit=N)` ou `erro:`
- `MILLBODY_SKIP_SETUP=1` antes de importar `scripts/postinstall.js` nos testes (auto-executa `run()` no import)
- Smoke: shimdir montado em tmpdir em runtime; NUNCA criar symlinks em `test/smoke/shims/` (versionado)
- `npm_config_scripts_prepend_node_path` gera warning no npm 11; não usar
- `doctor` e `resolveArch` continuam lançando fora de projeto (comportamento esperado)
