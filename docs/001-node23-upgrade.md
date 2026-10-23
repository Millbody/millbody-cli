# [001] - Atualização do @millbody/millbody-cli para Node 23

## Contexto
O CLI `@millbody/millbody-cli` (ESM, `"type": "module"`) não era compatível com Node 23.11.1: `getAppAccount` quebrava com `ERR_IMPORT_ATTRIBUTE_MISSING` (import de JSON sem attributes) e com import de módulo sem extensão, inviabilizando os comandos `create` e `update-apk`. Além disso, o projeto carregava dependências mortas e vulneráveis (38 vulnerabilidades por lockfile, incluindo 1 CRITICAL em `form-data` via `axios`).

## Escopo

### Incluído
- Compatibilidade com Node 23 em `src/services/api.js` (fetch nativo, leitura de JSON via `fs`, resolução robusta de Constants via `pathToFileURL`).
- Atualização/limpeza de dependências e manifesto (`package.json`, `.nvmrc`).
- Correção de `bin/millbody` (tratamento de erro) e `src/cli.js` (API de prompt).
- Remoção de código morto (`src/commands/index.js`).
- Regeneração coerente dos dois lockfiles.
- Primeira suíte de testes do repositório via `node --test`.

### Excluído (recomendações futuras — ver seção final)
- Command injection via `--account`/`themeName`.
- Reescrita de `executeCommand` com `spawn`/`maxBuffer`.
- Bug `kill -9 'lsof -t -i:8081'`.
- `process.exit()` sem código; ausência de `default` no `switch`.

## Solução Implementada

### Arquitetura
- **fetch nativo**: `node-fetch@2` removido; uso de `globalThis.fetch` com `AbortSignal.timeout(15000)` e checagem de `res.ok` (mensagem com `status`/`statusText`, sem expor corpo ou token).
- **Leitura de JSON**: `fs.promises.readFile` + `JSON.parse` (remoção de BOM; `SyntaxError` reporta o caminho do arquivo).
- **Resolução de Constants**: `pathToFileURL` tentando `Constants.js` e `Constants/index.js`, capturando `ERR_MODULE_NOT_FOUND` apenas do próprio caminho (guard checa URL `file://` e caminho posix, pois o Node 23 usa posix nas mensagens), com interop CJS (`mod.constants ?? mod.default?.constants`) e validação de `constants.uri`.
- **rootFolder injetável**: `getAppAccount(account, rootFolder = process.cwd())` — preserva compatibilidade com `create.js`/`updateApk.js` e viabiliza testes sem `process.chdir`.
- **Prompt**: o spike confirmou que o **inquirer 14 NÃO registra `type:"list"`** (lança `UnknownPromptTypeError`). Conforme a Decisão 5 do plano, migrou-se para `select` de `@inquirer/prompts`, e o pacote pesado `inquirer` foi removido. Em ambiente não-TTY (`!process.stdin.isTTY`) nenhum prompt é aberto — usa-se o default `"start"`.
- **bin/millbody**: `.catch` com exit code; `ExitPromptError` (Ctrl+C) → exit 130.
- **Testabilidade**: `parseArgumentsIntoOptions` e `promptForMissingOptions` exportados; roteamento aceita handlers injetáveis (`cli(args, handlers)`), evitando mock de módulo ESM experimental.

### Desvio de instrução (justificado)
A instrução original pedia remover `@inquirer/prompts` e manter `inquirer@14`. O spike provou que `inquirer@14` não oferece o tipo `list` usado pelo CLI. A resolução correta (prevista na Decisão 5 do plano) foi inversa: **manter `@inquirer/prompts` (leve) e remover `inquirer` (pesado)**. O objetivo da instrução — eliminar a cadeia vulnerável do `inquirer@10` (que puxava `tmp@0.0.33`) — foi atingido, com superfície ainda menor.

### Arquivos Modificados
| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/services/api.js` | Modificado |
| `src/cli.js` | Modificado |
| `bin/millbody` | Modificado |
| `package.json` | Modificado (engines `>=23`, `main` `src/cli.js`, `files`, `scripts.test`, deps, overrides/resolutions `tmp`) |
| `package-lock.json` | Regenerado |
| `yarn.lock` | Regenerado |
| `.nvmrc` | Criado (`23.11.1`) |
| `src/commands/index.js` | Removido (código morto, re-exports ESM quebrados, sem importadores) |
| `test/api.test.js` | Criado |
| `test/cli.test.js` | Criado |
| `test/smoke.test.js` | Criado |

### Commits (branch `node23-upgrade`)
1. `5fa3c5b` remove commands/index.js: código morto com re-exports ESM quebrados
2. `42282b6` refatorar api.js para Node 23: fetch nativo, fs.promises, pathToFileURL
3. `41adb51` refatorar cli.js: inquirer 14, não-TTY, handlers injetáveis, exportar helpers
4. `134d61a` adicionar catch em bin/millbody com exit code e tratamento ExitPromptError
5. `b1f6ea8` atualizar package.json e criar .nvmrc para Node 23
6. `1511bb3` regenerar lockfiles após remoção de dependências desnecessárias
7. `3150a73` adiciona suíte de testes node:test e corrige fallback Constants/index.js
8. `9c4982c` corrigir CVE-2026-44705: forçar tmp >= 0.2.6 via overrides/resolutions

## Testes
| Métrica | Valor |
|---------|-------|
| Framework | `node --test` (nativo, sem nova dependência) |
| Total de testes | 46 (pass 46 / fail 0) |
| Unit — getAppAccount | 7 (sucesso, !res.ok, rede caída, Constants ausente, millbody.json ausente, JSON inválido, fallback Constants/index.js) |
| Unit — cli | 22 (parse de flags, não-TTY, roteamento com handlers injetáveis) |
| Smoke | 24 (imports de módulo, `node --check`, spawn do bin: comando inexistente e sem template com stdin fechado) |

## Segurança (Trivy)
| Lockfile | Antes | Depois |
|----------|-------|--------|
| package-lock.json | 1 CRITICAL, 15 HIGH, 20 MEDIUM, 2 LOW (38) | 0 |
| yarn.lock | 1 CRITICAL, 15 HIGH, 20 MEDIUM, 2 LOW (38) | 0 |

Redução de 100% nos arquivos escaneados. A CRITICAL original (`form-data` CVE-2025-7783 via `axios`) foi eliminada com a remoção do `axios`. A HIGH residual em `tmp@0.0.33` (CVE-2026-44705), que chegava por `@inquirer/prompts → external-editor → tmp`, foi corrigida forçando `tmp ^0.2.6` via `overrides` (npm) e `resolutions` (yarn).

Métrica de superfície: `npm ls --all` caiu de ~1100+ para 186 linhas.

## Verificação de Qualidade
| Critério | Status |
|----------|--------|
| Build (N/A — ESM puro) | ✅ |
| `node --check` (12 arquivos) | ✅ |
| `npm ci` | ✅ |
| `yarn install --frozen-lockfile` | ✅ |
| Testes (46/46) | ✅ |
| Trivy (0 vulns em ambos lockfiles) | ✅ |
| Segurança (sem credenciais/token em logs) | ✅ |

## Recomendações Futuras (fora do escopo, NÃO implementadas)
1. **engines/versionamento**: elevar `engines.node` para `">=23.5.0"` (floor real do inquirer 14 / `@inquirer/prompts`) e subir a versão MAJOR do pacote (mudança breaking para consumidores em Node < 23.5). Node 23 é versão ímpar (Current, sem LTS) — avaliar suportar também 22 LTS (`"^22.13.0 || >=23.5.0"`).
2. **Proxy**: o `fetch` nativo não respeita `HTTP(S)_PROXY` no Node 23 — possível regressão para quem usava `axios` atrás de proxy corporativo.
3. **Command injection** em `create.js`/`updateApk.js`: `--account`/`themeName` são interpolados direto no shell via `executeCommand`.
4. **executeCommand**: reescrever com `spawn` + limite de `maxBuffer` (hoje usa `exec` com buffer padrão).
5. **Bug em `updateApk.js`**: `kill -9 'lsof -t -i:8081'` usa aspas simples em vez de crase/`$(...)` — o `lsof` nunca é executado.
6. **`process.exit()` sem código** em `functions.js`; ausência de `default` no `switch` de `cli.js`.
7. **Gerenciador único**: manter `package-lock.json` e `yarn.lock` dobra a manutenção e o risco de divergência — recomenda-se consolidar em um só (a decisão de remover um lockfile é do usuário).
8. **ESLint**: `eslint@9` está em devDeps sem `eslint.config.js` e sem script — adicionar config ou remover.
9. **`ttab`**: não aparece em import estático de `src`/`bin`; verificar se ainda é usado antes de eventual remoção.

---
**Verificado por:** Workflow Orchestrator
**Data:** 2026-10-23
**Status Final:** ✅ APROVADO (merge/push/publish pendentes de aprovação explícita do usuário)
