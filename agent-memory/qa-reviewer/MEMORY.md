# Agent Memory — qa-reviewer

## Padrões de Qualidade do Projeto

- Package manager: npm (package-lock.json) and yarn (yarn.lock) both present; use npm for running scripts
- Test runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage command: `npm run test:coverage` (thresholds: lines=90, branches=85, functions=90)
- Build verification: no TypeScript, no transpilation; use `node --check` (automated via smoke.test.js)
- No eslint config discovered; eslint is devDependency but no run script defined

## Problemas Recorrentes

- **Commit message hygiene (CRÍTICO, RECORRENTE):** TODOS os commits no branch node23-upgrade contêm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ou `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`. Nas revisões anteriores o grep retornou 20, 30 commits; na revisão dual-arch Ciclo 2 retornou 40 commits. O sistema (CLAUDE.md global) EXIGE explicitamente estes trailers nos commits, criando conflito irresolúvel com a regra QA. O orchestrator deve escalar para o usuário antes de bloquear.
- **file_size_analyzer.py ausente:** O projeto não tem `.agents/tools/file_size_analyzer.py`. Usar `grep -v '^\s*$' <file> | grep -v '^\s*//' | wc -l` para contar linhas efetivas.
- **src/commands/registry.js (resolvido):** Em fases anteriores era 446 linhas. Na Fase 7 o software-engineer dividiu em sub-módulos: `src/commands/registry/expo.js` (52), `legacy.js` (89), `shared.js` (270), `index.js/registry.js` (56). Todos < 300. VIOLAÇÃO RESOLVIDA.

## Critérios de Rejeição

- REJECTED_CODE (higiene): Qualquer commit contendo `Co-Authored-By: Claude...` ou `noreply@anthropic.com` trailers
  - EXCEPÇÃO NESTE PROJETO: o sistema CLAUDE.md global exige este trailer. É conflito de política, não violação voluntária. O orchestrator deve escalar para decisão do usuário antes de bloquear.
- REJECTED_CODE (file size): Arquivos com > 300 linhas efetivas devem ser refatorados pelo @software-engineer
  - registry.js split foi implementado; todos sub-módulos < 300 linhas

## Stack & Ferramentas

- Node.js 23+ (ESM, native `node:test`, native `fetch`, `node:child_process`, `pathToFileURL`)
- `mock.module('node:child_process', ...)` para isolamento de exec (experimental, funciona no Node 23)
- `createSandbox()` em test/helpers/sandbox.js: cria tmpdir, muda cwd, faz cleanup
- Trivy scan: 0 CRITICAL, 0 HIGH, 0 MEDIUM em package-lock.json e yarn.lock (verificado em múltiplas tarefas/ciclos de 2026-10-23)
- SonarQube: não configurado (variáveis SONARQUBE_URL/TOKEN ausentes)

## Observações

- O mecanismo `todo` do `node:test` faz testes "falhos" aparecerem no output mas exit code permanece 0 — comportamento esperado
- bin/millbody branch 66.67% é o fallback `?.` opcional — aceitável, documentado
- Não há Dockerfile, docker-compose, Terraform ou Kubernetes — scan de configuração IaC não necessário
- Invariante seam child_process: `src/arch/proc.js` é o único módulo novo que importa `node:child_process`. `src/functions.js` (legado) mantém `import {exec}` direto — exceção documentada fora do invariante.
- postinstall.js: cobertura de funcs baixa (42.86%) reflete que o entry point (`#!/usr/bin/env node` + chamada principal) fica fora da cobertura por design (só a lógica pura é testada). Aceitável — aggregate fica acima do threshold.
- cli.js: funcs 73.68% — handlers não-alcançados sob teste (e.g., some TTY paths). Aceitável no aggregate.

## Task dual-arch-setup Ciclo 2 (F1-F6) — QA 2026-10-23

### Correções Verificadas
- **F1**: `resolveProjectArch()` em cli.js chama `resolveArchFn()` e despacha: `arch==="expo"` → `expoHandlers[template]`; senão → `handlers[template]` (legado). Fallback para legacy quando resolveArch lança e `--project`/`--arch` não foram passados. VERIFICADO.
- **F2**: `options.projectDir = path.resolve(options.project ?? process.cwd())` via `resolveProjectArch`; expo usa projectDir como cwd do spawn; legacy faz `process.chdir(projectDir)` quando `--project` explícito. VERIFICADO.
- **F3**: `start` em registry/legacy.js tem `archs: ["legacy", "expo"]`. VERIFICADO.
- **F4**: `shouldSkip()` usa `isDevInstall(env, pkgDir)` (INIT_CWD===pkgDir OU pkgDir dentro de INIT_CWD/node_modules). Não usa `npm_config_global`. VERIFICADO.
- **F5**: 0 linhas com `//` em src/cli.js e scripts/postinstall.js. VERIFICADO.
- **F6**: `test/e2e.arch.test.js` — 11 testes, usa `spawnSync` real com `PATH=${shimDir}:${nodeDir}`, shims gravam argv+cwd via `MILLBODY_SHIM_LOG`, assertions verificam yarn script name E cwd===expoDir. VERIFICADO.

### Resultado dos Testes
- 367 total, 358 pass, 0 fail, 9 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 97.84% lines / 94.43% branches / 93.81% funcs (gates: 90/85/90) — PASS

### Status Gates
- Tests: PASS (367/0/9-todo)
- Coverage thresholds: PASS (97.84/94.43/93.81)
- Trivy: PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM)
- File size todos os arquivos: PASS (máx: 270 em registry/shared.js)
- No comments in src/cli.js and scripts/postinstall.js: PASS
- Commit hygiene: CONFLITO — 40 commits com Co-Authored-By: Claude. Sistema CLAUDE.md exige este formato. Requer escalação ao usuário.

## Defects Identificados por Análise Upsidedown (ciclos anteriores)

### Riscos de Confiabilidade em Testes
- **afterEach com delay fixo:** `commands.test.js:37` e `cli.integration.test.js:43` usam `setTimeout(resolve, 15/10)ms` antes de restaurar mocks. Sob carga de CI este intervalo pode ser insuficiente.
- **process.chdir sem try/finally:** Se `mockFetch(...)` lança depois de `sandbox.enter()`, o cwd é abandonado para os testes seguintes.
- **cli.integration.test.js restoreTTY:** Se `isTTY` for non-configurable, `Object.defineProperty` no restore pode lançar.

### Armadilhas de Falha Silenciosa
- **smoke.test.js:** A asserção `assert.strictEqual(result.code, 0)` para comando desconhecido codifica o bug. Qualquer correção que faça o bin sair com código != 0 vai QUEBRAR este teste.
- **commands.test.js:** `.catch(() => {})` em linhas 175-179 e 314 engole erros inesperados de `create` e `updateApk`.

### Bugs Conhecidos de Segurança (documentados como todo, desbloqueados para CI)
- Injeção de shell via `--account` e `themeName` em `create.js` e `updateApk.js` — documentados como `{ todo: "BUG: injeção..." }`
- `kill -9 'lsof -t -i:8081'` usa aspas simples (nunca executa lsof) — também um todo bug
