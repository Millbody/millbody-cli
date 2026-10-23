# Agent Memory — test-engineer

## Padrões de Teste
- Projeto ESM, `node:test` + `node:assert/strict`, zero libs externas. Arquivos em `test/*.test.js`; helpers em `test/helpers/` (fora do glob).
- Scripts: `npm test` e `npm run test:coverage` (flags `--experimental-test-module-mocks`, limiares 90/85/90, exclusões `test/**`, `**/millbody-api-test-*/**`, `**/millbody-sandbox-*/**`).
- Bugs de produção conhecidos ficam como `{ todo: '...' }` com o comportamento correto esperado.

## Estratégias de Mock
- Mocke só fronteiras externas: `mock.module('node:child_process', {namedExports:{exec}})` (vale para `import from "child_process"`), `globalThis.fetch`, `@inquirer/prompts`. NUNCA mocke módulos de produção (`functions.js`, `api.js`, `cli.js`): a cobertura mesclada entre processos fica errada (cli.js 23%, api.js 27%).
- Caminhos de `mock.module` são relativos ao arquivo que chama (helper em test/helpers precisa de `../../src`).
- Exec fake: EventEmitter com stdout/stderr, emite `exit` via setImmediate (executeCommand faz `await exec()` antes de ligar listeners).
- bin/millbody: testar via processo filho (cobertura do filho é mesclada); ExitPromptError via `--import` preload com `module.register` hook de resolve que troca `@inquirer/prompts`.
- process.exit mockado NÃO interrompe a execução: o código segue adiante (cuidado para não chegar em exec real).
- Fixtures com `fs.mkdtemp` + `realpathSync` + `process.chdir` e restauração (`test/helpers/sandbox.js`); aguardar `fs.writeFile` assíncrono (create.js) com `waitFor`/pequeno delay no afterEach.

## Erros Recorrentes & Soluções
- `mock.restoreAll()` também desfaz `mock.module` — restaure spies individualmente (`spy.mock.restore()`). Isso causou execução REAL de `npx react-native` uma vez; sempre bloquear exec real.
- Novo import com query string (`?run=`) não é mapeado na cobertura.
- Aviso ExperimentalWarning chega via console.error; filtre em asserts.

## Cobertura & Métricas
- Final: 99.55% linhas, 97.46% branches, 100% funções. Resíduo: cli.js 72-73 (artefato de mescla de cobertura: coberto isolado), branch do bin (ExitPromptError `?.`).

## Observações
- Executar `new Promise(async ...)` em executeCommand: se `exec` lançar, a promise nunca resolve (não testado).

## Dupla Arquitetura (dual-arch-setup) — padrões de teste
- Preferir INJEÇÃO DE DEPENDÊNCIA a `mock.module`. `runScript(dir, script, args, {spawn})`, detectores (`{execFile, env, existsSync}`), doctor/setup (`(options, deps)`), postinstall `run({env, platform, pkgDir, runSetup, log})` e `shouldSkip(env, platform, pkgDir)` são todos injetáveis — basta passar `mock.fn`/fakes. Helpers em `test/helpers/processFake.js`: `makeFakeChild({exitCode,signal,error})` e `makeExecFileFn(responses)` (deny-all: bin não roteirizado → erro).
- `mock.module("@inquirer/prompts", { namedExports: { confirm/select } })` só quando o código faz `await import("@inquirer/prompts")` (setup TTY). Use uma var `let impl` + wrapper para variar por teste; reset no `beforeEach`. ExitPromptError: `err.name="ExitPromptError"` e `assert.rejects` (setup NÃO engole).
- `scripts/postinstall.js` executa `run()` no fim do módulo ao ser importado. Defina `process.env.MILLBODY_SKIP_SETUP="1"` ANTES do `await import(...)` para o run de import pular; limpe `<pkgDir>/.millbody-postinstall.log` num `after`. node:test roda cada arquivo em processo separado → env não vaza entre arquivos.
- CUIDADO lifecycle: dirs criados no corpo de `describe()` (uma vez) NÃO podem ser limpos em `afterEach` (seriam apagados antes dos testes seguintes). Use lista `persistent` limpa só no `after`; `created` (per-test) no `afterEach`.
- doctor/setup usam `resolveArch` com fs REAL no projectDir → criar fixture real em tmpdir (reuse `expoProject`/`legacyThemeProject` de world.js) e passar `projectDir`. ttabPath resolvido via `require.resolve("ttab/...")` real, mas o `detect` da ttab usa `existsSync` injetado → controlável.
- `hasBinary` é varredura de PATH (fs), NÃO `command -v`; inclui `/opt/homebrew/bin` e `/usr/local/bin` sempre. `javaMajor` tenta `/usr/libexec/java_home` e cai para `java` direto, lendo stderr (`version "1.8..."` → 8; `"17..."` → 17).
- Invariante seam child_process: validado por teste estático escaneando os módulos NOVOS (src/arch, src/requirements, doctor/setup, scripts/postinstall) — só `src/arch/proc.js` importa. `src/functions.js` (legado, `import {exec} from "child_process"`) é exceção conhecida e fica FORA do escopo do invariante.
- Regressão D2: `cli(argv("start","--source","root",...))` com e sem `--arch legacy --project .` deve gerar `deepEqual(shell.commands())` — flags novas não alteram o legado.
- Testes reais de bin limitados a `--help`/`--version`/`help` (bin.test.js). doctor/setup via bin real NÃO são automatizados (detectores spawnam java/xcode-select reais) → CA02/CA03 são checagens MANUAIS do orchestrator.
- Cobertura final: all files 97.77 linhas / 94.50 branches / 91.23 funcs (gate 90/85/90, exit 0). Novos arquivos de teste: arch.detect, arch.runner, arch.expoCommands, requirements.detect, requirements, commands.doctor, commands.setup, postinstall, consistency.archs, regression.legacy. Suíte: 346 pass + 9 todo.
