# Agent Memory — qa-reviewer

## Padrões de Qualidade do Projeto

- Package manager: npm (package-lock.json) and yarn (yarn.lock) both present; use npm for running scripts
- Test runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage command: `npm run test:coverage` (thresholds: lines=90, branches=85, functions=90)
- Build verification: no TypeScript, no transpilation; use `node --check` (automated via smoke.test.js)
- No eslint config discovered; eslint is devDependency but no run script defined
- Coverage thresholds are AGGREGATE (all files), not per-file — individual files below 90% are acceptable if aggregate passes

## Problemas Recorrentes

- **file_size_analyzer.py ausente:** O projeto não tem `.agents/tools/file_size_analyzer.py`. Usar `wc -l` para contar linhas totais (todas < 300 encontradas nos ciclos atuais).
- **Contagem de fail flutuante:** `npm run test:coverage` pode reportar `fail N` em algumas execuções — verificar que são todos `# BUG:` todos (exit code permanece 0). Canônico: contar pelo `ℹ fail N` no sumário final.
- **src/commands/registry.js (resolvido):** Em fases anteriores era 446 linhas. Dividido em sub-módulos: expo.js (52), legacy.js (89), shared.js (276), index.js/registry.js (56). Todos < 300.
- **Commit messages enganosos:** Em project-root-detection, commit "atualiza versão 2.0.2 e documenta detecção de projeto no README" (027617f) só modificou package.json — README não foi atualizado. Verificar sempre `git show --stat <hash>` para confirmar o que realmente mudou.
- **Plan checkboxes:** A equipe nem sempre marca os `[x]` no plan.md para tarefas de código — verificar o git diff de arquivos de código, não os checkboxes.

## Critérios de Rejeição

- REJECTED_CODE (higiene): Qualquer commit contendo `Co-Authored-By: Claude...` ou `noreply@anthropic.com` trailers
  - Regra absoluta, sem exceção: o CLAUDE.md do usuário proíbe o trailer; lembretes de sessão não o justificam. Bloquear sempre.
- REJECTED_CODE (file size): Arquivos com > 300 linhas efetivas devem ser refatorados pelo @software-engineer
- REJECTED_CODE (Trivy): CRITICAL ou HIGH vulnerabilidades bloqueiam aprovação

## Stack & Ferramentas

- Node.js 23+ (ESM, native `node:test`, native `fetch`, `node:child_process`, `pathToFileURL`)
- `mock.module('node:child_process', ...)` para isolamento de exec (experimental, funciona no Node 23)
- `createSandbox()` em test/helpers/sandbox.js: cria tmpdir, muda cwd, faz cleanup
- Trivy scan: 0 CRITICAL, 0 HIGH, 0 MEDIUM em package-lock.json e yarn.lock (verificado em 2026-10-23, 2026-10-24, 2026-10-25)
- SonarQube: não configurado (variáveis SONARQUBE_URL/TOKEN ausentes)

## Observações

- O mecanismo `todo` do `node:test` faz testes "falhos" aparecerem no output mas exit code permanece 0 — comportamento esperado
- bin/millbody branch 66.67% é o fallback `?.` opcional — aceitável, documentado
- Não há Dockerfile, docker-compose, Terraform ou Kubernetes — scan de configuração IaC não necessário
- Invariante seam child_process: `src/arch/proc.js` é o único módulo novo que importa `node:child_process`. `src/functions.js` (legado) mantém `import {exec}` direto — exceção documentada fora do invariante.
- postinstall.js: cobertura de funcs pode ser baixa pelo entry point (`#!/usr/bin/env node` + run()) fora da cobertura por design. Aceitável quando aggregate fica acima do threshold.
- cli.js: funcs 73.68% em ciclos anteriores — handlers não-alcançados sob teste (TTY paths). Aceitável no aggregate.
- setup.js linhas 50-60 uncovered = brew-cask path; linhas 91-96 = TTY confirm path; 164-166 = full-success path. Aggregate > 90 é suficiente.
- functions.js linhas 52-65 uncovered = chdir ao ancestral (path "walkUp encontrou em ancestor e faz chdir"); aceitável — aggregate 96.89% acima do threshold.

## Task postinstall-fix (v2.0.1) — QA 2026-10-24

### Resultado dos Testes
- 377 total, 368 pass, 0 fail, 9 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 97.84% lines / 94.66% branches / 94.83% funcs (gates: 90/85/90) — PASS

### Status Gates
- Tests/Coverage/Trivy/File size/Commit hygiene/Scope: todos PASS
- Veredito: APPROVED

## Task project-root-detection (v2.0.2) — QA 2026-10-25

### Implementação Verificada
- **detect.js**: `MARKERS` fonte única + predicados exportáveis (`hasExpoMarker`, `hasLegacyMarker`, `hasThemeMarkers`, `hasRootMarkers`); helper `walkUp(startDir, predicate, {home})` (D1b) com boundary D1; `findProjectRoot({startDir, archFlag, home})` (D2) com validação por predicado direto. 235 linhas.
- **cli.js**: `SELF_RESOLVING = new Set(["doctor","setup"])` pula `resolveProjectArch` (pass-through); execução usa busca ascendente + chdir realpathSync nos dois lados + try/catch (D4). 218 linhas.
- **functions.js**: `checkFolderBySource` preserva nome/assinatura; falha→throw com prefixos "TEMA MILLBODY"/"framework MILLBODY APP"; busca ascendente via `walkUp`; reusa predicados de detect.js (D5). 67 linhas.
- **create.js, updateApk.js**: `process.chdir("./")` removido (D6). 63 e 49 linhas.
- **package.json**: versão bumped para 2.0.2.
- **SELF_RESOLVING**: garante que `setup --all` e `doctor` resolvem internamente — CA06 satisfeito.

### Testes Verificados
- test/arch.findRoot.test.js: 13 unit tests, home injetado — cobre CA03, CA08, EC03-EC07
- test/e2e.rootDetection.test.js: 9 e2e spawn real — cobre CA01, CA02, CA04, CA05, CA06
- test/functions.test.js: `checkFolderBySource` throws com prefixos corretos

### Resultado dos Testes
- 415 total, 407 pass, 0 fail, 8 todo (bugs pré-existentes fora de escopo), exit 0
- Coverage: 96.89% lines / 93.80% branches / 96.77% funcs (gates: 90/85/90) — PASS

### Status Gates
- Tests: PASS (415/407/0-fail/8-todo)
- Coverage thresholds: PASS (96.89/93.80/96.77)
- Trivy: PASS (0 CRITICAL, 0 HIGH, 0 MEDIUM)
- File size: PASS (max 235 em detect.js; todos < 300)
- Commit hygiene: PASS (0 matches para Claude/AI)
- Scope: PASS (todos os arquivos alterados dentro do escopo)
- Veredito: APPROVED (com nota MINOR sobre README não atualizado)

### Nota MINOR (não bloqueante)
- T3.2 [LOW]: README.md não foi atualizado com documentação de busca ascendente, boundary $HOME, exit code 1, e decisão D7. O commit "027617f" descreve "documenta no README" mas só modificou package.json. Todos os CA01-CA08 são comportamentais e passam; a documentação é [LOW] e não está em RF01-RF08.

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
