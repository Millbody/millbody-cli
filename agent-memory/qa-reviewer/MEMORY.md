# Agent Memory — qa-reviewer

## Padrões de Qualidade do Projeto

- Package manager: npm (package-lock.json) and yarn (yarn.lock) both present; use npm for running scripts
- Test runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage command: `npm run test:coverage` (thresholds: lines=90, branches=85, functions=90)
- Build verification: no TypeScript, no transpilation; use `node --check` (automated via smoke.test.js)
- No eslint config discovered; eslint is devDependency but no run script defined

## Problemas Recorrentes

- **Commit message hygiene (CRÍTICO, RECORRENTE):** TODOS os commits no branch node23-upgrade contêm `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ou `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`. Nas revisões de cli-help-readme (2026-10-23) o grep retornou 20 commits; na revisão de dual-arch-setup (Fase 7) o grep retornou 30 commits. O orchestrator informou que o usuário explicitamente EXIGIU este formato E PROIBIU reescrita de histórico ("NÃO reescreva histórico"). Este é um conflito de política (regra QA vs. instrução explícita do usuário) que o orchestrator deve escalar para o usuário resolver.
- **file_size_analyzer.py ausente:** O projeto não tem `.agents/tools/file_size_analyzer.py`. Usar `grep -v '^\s*$' <file> | wc -l` para contar linhas efetivas.
- **src/commands/registry.js excede 300 linhas:** Na task cli-help-readme era 273 linhas (OK). Na task dual-arch-setup (Fase 4), o software-engineer adicionou comandos doctor/setup/connect-alderaan/web e o arquivo cresceu para 446 linhas efetivas — VIOLAÇÃO. Deve ser refatorado pelo @software-engineer (SRP: separar descritores por família ou por arquivo de subregistro).

## Critérios de Rejeição

- REJECTED_CODE (higiene): Qualquer commit contendo `Co-Authored-By: Claude...` ou `noreply@anthropic.com` trailers
  - Fix canônico: `git filter-branch -f --msg-filter 'grep -v -i -E "^(Co-Authored-By: Claude|Co-Authored-By:.*anthropic)"' origin/master..HEAD`
  - EXCEPÇÃO NESTE PROJETO: o usuário exigiu o trailer E proibiu reescrita. O orchestrator deve escalar para decisão do usuário antes de bloquear.
- REJECTED_CODE (file size): Arquivos com > 300 linhas efetivas devem ser refatorados pelo @software-engineer
  - registry.js (446 linhas) — violação ativa; split sugerido: `src/commands/registry/legacy.js` + `src/commands/registry/expo.js` + `src/commands/registry/shared.js` + `src/commands/registry/index.js`
- Note: Os 9 testes `todo` são corretos — documentam bugs de produção conhecidos fora do escopo deste branch

## Stack & Ferramentas

- Node.js 23+ (ESM, native `node:test`, native `fetch`, `node:child_process`, `node:fs/promises`, `pathToFileURL`)
- `mock.module('node:child_process', ...)` para isolamento de exec (experimental, funciona no Node 23)
- `mock.method(globalThis, 'fetch', ...)` para isolamento de fetch
- `createSandbox()` em test/helpers/sandbox.js: cria tmpdir, muda cwd, faz cleanup
- Trivy scan: 0 CRITICAL, 0 HIGH, 0 MEDIUM em package-lock.json e yarn.lock (verificado em 2026-10-23 em múltiplas tarefas)
- SonarQube: não configurado (variáveis SONARQUBE_URL/TOKEN ausentes)

## Observações

- O mecanismo `todo` do `node:test` faz testes "falhos" aparecerem no output mas exit code permanece 0 — comportamento esperado
- bin/millbody branch 66.67% é o fallback `?.` opcional — aceitável, documentado
- Não há Dockerfile, docker-compose, Terraform ou Kubernetes — scan de configuração IaC não necessário
- Invariante seam child_process: `src/arch/proc.js` é o único módulo novo que importa `node:child_process`. `src/functions.js` (legado) mantém `import {exec}` direto — exceção documentada fora do invariante.
- postinstall.js: cobertura de funcs baixa (42.86%) reflete que o entry point (`#!/usr/bin/env node` + chamada principal) fica fora da cobertura por design (só a lógica pura é testada). Aceitável — aggregate fica acima do threshold.
- cli.js: funcs 73.68% — handlers não-alcançados sob teste (e.g., some TTY paths). Aceitável no aggregate.

## Task dual-arch-setup Fase 7 — Revisão de Testes (2026-10-23)

### Qualidade dos Testes (T7.1–T7.8)
- Todos os 10 novos arquivos de teste abaixo de 300 linhas efetivas (máx: 172 em arch.expoCommands.test.js)
- Nenhum teste executa processo externo real (spawn/execFile todos injetados)
- Seam invariant test: test/consistency.archs.test.js verifica estaticamente que só src/arch/proc.js importa child_process
- T7.8 (regressão): doctor/setup via bin real não automatizados — decisão correta (detectores reais spawnariam java/xcode-select)
- Fixtures: tmpdir + world.js; mocks restaurados via afterEach

### Resultado dos Testes
- 355 total, 346 pass, 0 fail, 9 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 97.77% lines / 94.50% branches / 91.23% funcs (gates: 90/85/90) — PASS

### Status Gates
- Tests: PASS (355/0/9-todo)
- Coverage thresholds: PASS (97.77/94.50/91.23)
- Trivy: PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM)
- No orphan files: PASS (sem .millbody-postinstall.log)
- No external processes in tests: PASS
- File size (testes): PASS (todos < 300 linhas)
- File size (src/commands/registry.js): FAIL — 446 linhas efetivas (> 300) → REJECTED_CODE
- Commit hygiene: CONFLITO — 30 commits com Co-Authored-By: Claude. Requer escalação ao usuário.

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
