# Entrega 003 — Suporte a Dupla Arquitetura (legacy + expo/app-mobile) + Setup/Doctor Automático

> Worktree: `.worktrees/node23-upgrade` (branch `node23-upgrade`)
> Data: 2026-10-23

---

## Contexto

O CLI até então suportava apenas projetos legacy (mbCore/, millbodyApp.json, react-native CLI, fastlane). Esta entrega adiciona suporte a uma segunda arquitetura — projetos baseados no repositório `app-mobile` (Expo SDK ~57, React Native 0.86, Yarn 1.x) — com detecção automática, instalação automática de dependências externas e dois novos comandos (`doctor`, `setup`).

---

## Escopo

### Adicionado

- Detecção automática de arquitetura (expo vs legacy) por marcadores no diretório do projeto
- Roteamento lazy por arquitetura no `cli.js` (legado permanece inalterado — D2)
- Novos comandos expo: `build-ios`, `web`, `connect-alderaan`
- Novo comando `doctor` (read-only, tabela ✓/✗ de requisitos)
- Novo comando `setup` (instala requisitos faltantes via brew/corepack/gem)
- Postinstall automático best-effort (`scripts/postinstall.js`)
- Flags globais `--arch`, `--project/-p`, `--yes/-y`, `--dry-run`

### Não alterado

- Fluxo legacy: handlers, comandos externos, mensagens e exit codes são bit-a-bit idênticos
- 213 testes legados (pass) + 9 `# BUG` todos continuam exatamente iguais

---

## Solução técnica

### Arquitetura de módulos

```
src/arch/
  proc.js           — seam único para node:child_process (D1)
  detect.js         — detectArchitecture + resolveArch (D5, fail-safe)
  runner.js         — runScript via spawn sem shell (RF05, RNF03)
  expoCommands.js   — SSOT de mapeamento comando→script yarn + makeExpoHandlers

src/requirements/
  requirements.js   — SSOT de requisitos externos + evaluateRequirements (O2)
  detect.js         — hasBinary (PATH scan M4), javaMajor (stderr+java_home M4), hasAndroidSdk, hasXcode

src/commands/
  doctor.js         — renderDoctorTable + handler doctor
  setup.js          — handler setup com dry-run, yes, TTY e instaladores injetáveis

scripts/
  postinstall.js    — shouldSkip (puro, D3) + run (import-testável, D4/M7)
```

### Decisões arquiteturais chave

- **D1 — Seam de child_process**: somente `src/arch/proc.js` importa `node:child_process`; todos os demais módulos recebem `spawn`/`execFile` por injeção de dependência.
- **D2 — Lazy arch resolution**: a resolução de arquitetura só ocorre para comandos `doctor`/`setup` ou quando `--arch expo` é passado; o fluxo legacy não é tocado.
- **D3 — shouldSkip puro e endurecido**: pula em MILLBODY_SKIP_SETUP, qualquer variável CI padrão, plataforma não-darwin, instalação não-global (`npm_config_global !== "true"`), dev install (INIT_CWD === pkgDir), e root uid 0.
- **D4 — Postinstall never fails**: handlers `uncaughtException`/`unhandledRejection`, timeout SIGKILL 180s, try/catch em torno de tudo, `process.exitCode = 0` sempre.
- **D5 — Detecção fail-safe**: `detectArchitecture` retorna `{arch, reason, ambiguous}`; leituras em `try/catch`; precedência: `--arch` > expo > legacy > null (erro).
- **M4 — PATH scan para binários**: `hasBinary` faz scan do PATH com `fs.existsSync` (sem processos), sempre inclui `/opt/homebrew/bin` e `/usr/local/bin`; openjdk@17 keg-only detectado via `/usr/libexec/java_home -v 17`.
- **RF12 — ttab via createRequire**: resolvido de `node_modules` do CLI, não do PATH do sistema.

### Mapeamento expo (SSOT)

| Comando CLI        | Script yarn           | Observação                         |
|--------------------|-----------------------|------------------------------------|
| `start`            | `start`               | `expo start`                       |
| `run-ios`          | `ios`                 | `expo run:ios`                     |
| `run-android`      | `android`             | `expo run:android`                 |
| `update-apk`       | `millbody`            | pipeline completo                  |
| `build-android`    | `predeploy:android`   | clean+install+compile+prebuild     |
| `build-ios`        | `predeploy:ios`       | clean+install+compile+prebuild+xed |
| `web`              | `web`                 | `expo start --web`                 |
| `connect-alderaan` | `connect-alderaan`    | atualiza millbody.json (idempotente)|
| `create`           | `millbody:create`     | grava .env.account primeiro        |
| `codepush`         | (não suportado)       | EAS Update no expo; exit 1         |
| `test`             | (não suportado)       | jest --watchAll interativo; exit 1 |

---

## Arquivos criados

- `src/arch/proc.js` — seam de child_process
- `src/arch/detect.js` — detectArchitecture + resolveArch + ARCHS
- `src/arch/runner.js` — runScript
- `src/arch/expoCommands.js` — EXPO_COMMAND_MAP + upsertEnvVar + makeExpoHandlers
- `src/requirements/requirements.js` — requirements[] + requirementsFor + evaluateRequirements
- `src/requirements/detect.js` — hasBinary + javaMajor + hasAndroidSdk + hasXcode
- `src/commands/doctor.js` — renderDoctorTable + doctor handler
- `src/commands/setup.js` — setup handler
- `scripts/postinstall.js` — shouldSkip + run (import-testável)
- `docs/003-dual-arch-setup.md` — este documento

## Arquivos modificados

- `src/cli.js` — parse de --arch/--project/-p/--yes/--dry-run, roteamento lazy, handlers doctor/setup
- `src/commands/registry.js` — descritores novos, campo archs, flags globais
- `src/help.js` — render suporte por arquitetura, flags --arch/--project
- `package.json` — script postinstall, scripts em files[]
- `README.md` — seções de arquitetura, instalação automática, tutorial expo, novos comandos
- `test/helpers/world.js` — fixtures expo/legacy/ambiguous
- `test/registry.test.js` — cobertura de archs e novos comandos

---

## Testes

- `npm test`: 240 testes, 231 pass, 0 fail, 9 todo (todos os 9 são `# BUG` do legado, fora de escopo)
- Sem regressão: os 213 pass legados + 9 todo continuam exatamente iguais
- Consistência README↔registry: 3 testes passando (eram 2 falhas antes desta entrega)

---

## Verificação manual

```bash
# Verificar ajuda (lista doctor, setup, build-ios, web, connect-alderaan)
node bin/millbody --help

# Verificar requisitos no app-mobile (read-only)
node bin/millbody doctor --project ../../../app-mobile

# Ver plano de setup sem executar
node bin/millbody setup --dry-run --project ../../../app-mobile
```

---

## Item E — Segurança: senhas em texto puro no app-mobile

**IMPORTANTE: Este item é somente documentação. A correção está fora do escopo deste repositório (outro repo).**

O arquivo `app-mobile/millbody.json` contém senhas do keystore Android em **texto puro**:
- `android.key.storePassword` — senha do keystore
- `android.key.keyPassword` — senha da chave

Ação recomendada para o time responsável pelo `app-mobile`:
1. Remover as senhas do arquivo commitado
2. Usar variáveis de ambiente ou um vault (ex.: `.env` + `.gitignore`, ou EAS Secrets)
3. Rotacionar as senhas comprometidas

**Divergência adicional documentada:** `account.json` contém `"account": "sfall"` enquanto `millbody.json.account` contém `"crossevolution"`. O `account.json` não é lido pela configuração atual do legado — pode ser um arquivo órfão ou de configuração alternativa não integrada.
