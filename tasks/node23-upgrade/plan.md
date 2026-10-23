# Plano — Atualização do @millbody/millbody-cli para Node 23

## 🎯 SCOPE

### Contexto
CLI Node.js ESM (`"type": "module"`). Ambiente local: Node v23.11.1, npm 11.13.0, yarn 1.22.22, trivy 0.71.1. Objetivo: tornar o projeto compatível e saudável no Node 23, reduzir vulnerabilidades e remover dependências mortas, sem alterar o comportamento funcional observável dos comandos.

### Arquivos Afetados
- [x] `src/services/api.js` — leitura JSON via fs, resolução robusta de Constants, fetch nativo, rootFolder injetável
- [x] `src/cli.js` — API do inquirer 14, exportar helpers testáveis, tratar não-TTY
- [x] `bin/millbody` — adicionar `.catch` + exit code e tratar `ExitPromptError` (ADICIONADO via análise dual)
- [x] `src/commands/index.js` — REMOVER (código morto quebrado, não importado)
- [x] `package.json` — engines, main, files, scripts.test, remoção de deps, resolutions
- [x] `.nvmrc` — criar com `23.11.1`
- [x] `package-lock.json` + `yarn.lock` — regenerar coerentes (NÃO apagar)
- [ ] `test/` — novos testes com `node --test` (sem nova dependência)

### Fora do Escopo (registrar como recomendações futuras, NÃO implementar)
- Command injection via `--account`/`themeName` em `create.js`/`updateApk.js`
- Reescrita de `executeCommand` com `spawn`/`maxBuffer`
- Bug `kill -9 'lsof -t -i:8081'` (aspas simples vs crase) em `updateApk.js`
- `process.exit()` sem código em `functions.js`
- Ausência de `default` no `switch` do `cli.js`
- Exceção: se uma mudança de Node 23 tocar essas linhas, não piorar.

### Riscos de Impacto
- R1: `mbCore/Constants` e `mbCore/fastlane/keys/millbody.json` vivem no projeto CONSUMIDOR, não neste repo → testes devem usar fixtures em diretório temporário e mock de `fetch`.
- R2: Bump de inquirer major (10→14) pode mudar a API de `prompt`/tipos.
- R3: Regenerar dois lockfiles pode introduzir divergência; manter ambos coerentes com o mesmo `package.json`.
- R4: Remover `resolutions` pode reabrir vuln transitiva — validar com trivy depois.

## 📋 REQUIREMENTS

### Requisitos Funcionais
- [x] RF01: `getAppAccount` resolve Constants e millbody.json no Node 23 sem `ERR_IMPORT_ATTRIBUTE_MISSING` nem erro de resolução sem extensão.
- [x] RF02: `getAppAccount` usa `fetch` nativo e verifica `res.ok` com mensagem de erro clara.
- [x] RF03: Resolução de Constants tenta `Constants.js` e `Constants/index.js` via `pathToFileURL`; erro claro se nenhum existir.
- [x] RF04: `cli` continua oferecendo o prompt de seleção de comando e roteando corretamente.
- [x] RF05: Comando inexistente não lança erro de import (smoke test).

### Requisitos Não-Funcionais
- [x] RNF01: `engines.node >= 23` e `.nvmrc` = 23.
- [x] RNF02: Reduzir vulnerabilidades reportadas pelo Trivy (baseline 38: 1 CRITICAL, 15 HIGH, 20 MEDIUM, 2 LOW) → pós-upgrade: 2 (1 HIGH, 1 LOW) por lockfile.
- [x] RNF03: Sem dependências mortas (axios, strip-ansi, node-fetch removidos; @inquirer/prompts mantido como dep direta por ser usado em cli.js via select).
- [x] RNF04: `node --check` passa em todos os 12 arquivos .js (commands/index.js removido).
- [x] RNF05: Sem comentários no código novo; código auto-documentado; sem credenciais.

### Critérios de Aceitação
- [x] CA01: `npm test` executa suíte `node --test` e passa.
- [x] CA02: `node bin/millbody <comando-inexistente>` (com stdin não interativo) termina sem exceção de import.
- [ ] CA03: Trivy pós-upgrade reporta redução significativa vs baseline (relatar antes/depois).
- [ ] CA04: `main` do package.json aponta para arquivo existente ou é removido.

### Edge Cases
- EC01: `millbody.json` ausente → erro claro.
- EC02: Nem `Constants.js` nem `Constants/index.js` existem → erro claro.
- EC03: `fetch` retorna `!res.ok` → mensagem clara (não quebrar com JSON parse de corpo de erro).
- EC04: prompt com stdin não-TTY (ambiente de teste/CI).

## 🏗️ DESIGN

### Decisões
1. **JSON import** → usar `fs.promises.readFile` + `JSON.parse` em vez de import attributes. Motivo: mais portável, evita acoplamento à sintaxe `with { type: "json" }` e facilita mock. Validar existência (EC01), remover BOM antes de parsear, e em `SyntaxError` relatar o caminho do arquivo SEM despejar conteúdo (não vazar token — RNF05).
2. **Resolução de Constants** → `pathToFileURL` + tentativa ordenada `Constants.js` → `Constants/index.js`. Estratégia: tentar `import()` e capturar `ERR_MODULE_NOT_FOUND` apenas para o próprio caminho (checar `err.url`/mensagem para não mascarar dependência interna faltante do Constants). Ler `mod.constants ?? mod.default?.constants` (interop CJS). Validar `constants?.uri` com erro claro (EC02). Documentar que `Constants.ts` não é suportado sem type-stripping no Node 23.
3. **rootFolder injetável** → `getAppAccount(account, rootFolder = process.cwd())`. Motivo: evita `process.chdir` global nos testes (que contamina execução) e mantém a API dos comandos inalterada.
4. **fetch nativo** → remover `import fetch from "node-fetch"`; usar `globalThis.fetch`; `AbortSignal.timeout(15000)`; checar `res.ok` incluindo `status`/`statusText` na mensagem (sem corpo); tratar falha de rede (`err.cause`) com mensagem clara (EC03). Nota: fetch nativo não respeita `HTTP(S)_PROXY` no Node 23 — registrar no doc como possível regressão para quem usava axios atrás de proxy.
5. **inquirer 14** → bump para 14.x mantendo o import default clássico e `inquirer.prompt([{type:"list", default}])`. OBRIGATÓRIO: spike (`node -e` com pty/`script`) ANTES de fixar, validando `type:"list"`, `default` e comportamento TTY vs não-TTY. Se `list`/`default` não funcionarem como hoje, migrar para `import { select } from "@inquirer/prompts"` e manter `@inquirer/prompts` como dep DIRETA (ajustar RNF03 nesse caso). Em não-TTY, não pendurar: detectar `!process.stdin.isTTY` e seguir com o default sem abrir prompt. Tratar `ExitPromptError` (Ctrl+C → exit 130).
6. **commands/index.js** → REMOVER. `export * from './start'` (sem `.js`, quebrado no ESM) de módulos que só têm `default export` não exporta nada, e nenhum arquivo o importa. Código morto quebrado (DRY/YAGNI).
7. **bin/millbody** → `cli(process.argv).catch(err => { if (err?.name === 'ExitPromptError') process.exit(130); console.error(err?.message ?? err); process.exitCode = 1; })`. Sem isso, os erros claros de `getAppAccount` viram unhandled rejection com stack trace.
8. **package.json** → `engines.node`: o usuário pediu `>=23`; inquirer 14 exige `>=23.5.0`. DECISÃO: usar `">=23"` conforme instrução explícita do usuário e registrar no doc de entrega a recomendação de elevar para `">=23.5.0"` (floor real do inquirer) e de subir MAJOR do pacote (breaking p/ Node<23.5). `main` → `src/cli.js` (arquivo real, seguro para import; shebang não executa nada). Adicionar `"files": ["bin","src"]` para não publicar `tasks/`/`test/`. Remover `axios`, `@inquirer/prompts`, `strip-ansi`, `node-fetch` (confirmados sem import estático em `src`/`bin`). Manter `arg`, `ttab` (não listados para remoção; registrar recomendação de verificar `ttab`). `resolutions`: npm ignora (é sintaxe yarn); remover e validar com `npm ls wrap-ansi` + `yarn why wrap-ansi` + trivy. Se sobrar CVE transitiva, usar `overrides` (npm) + `resolutions` (yarn) só para o resíduo.
9. **Lockfiles** → regenerar em diretórios/node_modules limpos: `rm -rf node_modules` entre npm e yarn. Validar com `npm ci` e `yarn install --frozen-lockfile`. Rodar trivy por lockfile separadamente (um `trivy fs .` soma os dois). Ambos mantidos; recomendação de consolidar em um gerenciador vai ao doc.
10. **Helper compartilhado (reuso)** → extrair `resolveConsumerModule()`/`readConsumerJson()` reutilizáveis para centralizar EC01/EC02 e o ponto de mock. Opcional — só se não aumentar risco; "scope is law".

### Fluxo (getAppAccount)
`account`,`rootFolder` → resolve Constants (valida uri) → lê millbody.json (token) → fetch com timeout → valida res.ok → JSON

### Testes (node --test, em `test/`, sem dependências novas)
- Config: `scripts.test = "node --test test/"` (dir explícito para não varrer `tasks/`/`node_modules`). Mock com `mock.method(globalThis,'fetch',...)` + `mock.restoreAll()` em `afterEach`. Sem `describe` concorrente.
- Unit `getAppAccount`: fixtures `mbCore/Constants.js` e `mbCore/fastlane/keys/millbody.json` em tmpdir ÚNICO por teste (`fs.mkdtemp`), passando `rootFolder` (sem `process.chdir`). Casos: sucesso; `!res.ok`; rede caída; corpo não-JSON com `res.ok`; Constants ausente; millbody.json ausente; JSON inválido.
- Unit cli: exportar `parseArgumentsIntoOptions` e `promptForMissingOptions`; UM teste parametrizado de roteamento com handlers injetáveis (`cli(args, handlers)`), evitando mock de módulo ESM experimental.
- Smoke de carga: `import()` de cada módulo `src/**` (detecta imports quebrados que `node --check` não pega) + `node --check` sintático.
- Smoke bin: spawn `node bin/millbody <inexistente>` e `node bin/millbody` (sem template) com stdin fechado (`stdio:['ignore',...]`) + timeout; assertar ausência de `ERR_MODULE_NOT_FOUND`/`ERR_IMPORT_ATTRIBUTE_MISSING`/hang (não assertar stderr vazio por causa de `ExperimentalWarning`).

## 📝 TASKS

### Fase 1: Código-fonte
- [x] T1.1: [MEDIUM] Refatorar `src/services/api.js` (fetch nativo + timeout + res.ok + rede; leitura JSON via fs com BOM/erro claro; resolução robusta de Constants via pathToFileURL + interop CJS + valida uri; `rootFolder` injetável).
- [x] T1.2: [MEDIUM] Spike inquirer 14 e ajustar `src/cli.js` (list/default vs select, não-TTY, exportar `parseArgumentsIntoOptions` e `promptForMissingOptions`, handlers injetáveis para roteamento). Resultado do spike: type:list não registrado em inquirer 14 → migrado para select de @inquirer/prompts.
- [x] T1.3: [LOW] Remover `src/commands/index.js` (código morto quebrado) — justificado no DESIGN.
- [x] T1.4: [LOW] Ajustar `bin/millbody` com `.catch` + exit code e `ExitPromptError` → 130.

### Fase 2: Manifesto e ambiente
- [x] T2.1: [MEDIUM] Atualizar `package.json`: engines `>=23`, main `src/cli.js`, `files`, scripts.test (`node --test test/`), remover axios/strip-ansi/node-fetch/inquirer, manter @inquirer/prompts, remover `resolutions`.
- [x] T2.2: [LOW] Criar `.nvmrc` com `23.11.1`.
- [x] T2.3: [MEDIUM] Regenerar lockfiles em dirs limpos; validado com `npm ci` e `yarn --frozen-lockfile`; npm ls --all: 186 linhas; wrap-ansi vem apenas de @inquirer/core.

### Fase 3: Testes
- [x] T3.1: [MEDIUM] Testes `node --test` para `getAppAccount` (tmpdir único + rootFolder + mock fetch com restoreAll; casos de sucesso/erro/rede/JSON inválido/arquivos ausentes).
- [x] T3.2: [LOW] Teste parametrizado de parse + roteamento do cli (handlers injetáveis).
- [x] T3.3: [LOW] Smoke de carga (`import()` de cada módulo) + `node --check` + smoke do bin (inexistente e sem template, stdin fechado + timeout).

### Fase 4: Validação
- [ ] T4.1: [LOW] Rodar `trivy fs --scanners vuln` por lockfile e registrar antes/depois.
- [ ] T4.2: [LOW] Rodar `npm test` e capturar saída.

## Análise Dual

### 🔴 Riscos (upsidedown) incorporados
- `engines.node >=23` conflita com inquirer 14 (`>=23.5.0`): mantido `>=23` por instrução do usuário; recomendação de elevar registrada no doc + MAJOR bump.
- inquirer 14 API não verificada → spike OBRIGATÓRIO antes de fixar (T1.2).
- `bin/millbody` sem catch → unhandled rejection; adicionado T1.4 ao escopo.
- Prompt em não-TTY pendura/`ExitPromptError` → detectar `!isTTY`, usar default; smoke sem template.
- `getAppAccount`: `rootFolder` injetável, valida `constants.uri`, timeout, rede, JSON inválido, BOM, interop CJS, capturar `ERR_MODULE_NOT_FOUND` só do próprio path.
- Lockfiles: gerar em dirs limpos, validar com `npm ci`/`yarn --frozen-lockfile`, trivy por lockfile; `wrap-ansi` via `npm ls`/`yarn why`.
- `node --check` não pega imports quebrados → adicionar smoke de carga via `import()`.
- `files` no package.json para não publicar `tasks/`/`test/`.
- Proxy: fetch nativo ignora `HTTP(S)_PROXY` → registrar possível regressão no doc.

### 🟢 Oportunidades (downsideup) incorporadas
- fetch nativo + `node --test` eliminam dependências (zero nova dep de teste).
- Exportar `parseArgumentsIntoOptions`/`promptForMissingOptions` → UM teste parametrizado cobre os 7 comandos.
- Helper compartilhado de leitura do consumidor (opcional) centraliza EC01/EC02 e o mock.
- Reportar `npm ls --all` (contagem de pacotes) além do Trivy como métrica de superfície.
- Paralelização segura: onda 1 com 3 agentes (arquivos disjuntos), serializando apenas `package.json`/lockfiles. Como o repo é pequeno, o software-engineer executará em sequência enxuta — a paralelização fica como orientação, não obrigação.

### Baseline Trivy (medido)
- `trivy fs --scanners vuln .` no estado inicial: 76 achados (2 CRITICAL, 30 HIGH, 40 MEDIUM, 4 LOW) — isso DUPLICA porque escaneia `package-lock.json` E `yarn.lock`. Por lockfile = 38 (1 CRITICAL, 15 HIGH, 20 MEDIUM, 2 LOW), coerente com o baseline informado. Reportar antes/depois por lockfile.

### Fase 5: Cobertura de testes
- [x] T5.1: Helpers de teste (`test/helpers/sandbox.js`, `world.js`, preload de ExitPromptError) sem dependências novas.
- [x] T5.2: Testes unitários de `functions.js` (exec mockado via `mock.module('node:child_process')`) e `bin/millbody` (processo filho em pasta vazia).
- [x] T5.3: Testes dos comandos (`start`, `codepush`, `runAndroid`, `buildAndroid`, `runIos`, `test`, `create`, `updateApk`) com exec/fetch mockados.
- [x] T5.4: Integração `cli` -> comandos e prompt interativo; caso de `constants.uri` ausente em `api.js`.
- [x] T5.5: Scripts `test` e `test:coverage` (limiares 90/85/90). Bugs conhecidos registrados como testes `todo`.
