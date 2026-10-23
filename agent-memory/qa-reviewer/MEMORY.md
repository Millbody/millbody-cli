# Agent Memory — qa-reviewer

## Padrões de Qualidade do Projeto

- Package manager: npm (package-lock.json) and yarn (yarn.lock) both present; use npm for running scripts
- Test runner: `node --test --experimental-test-module-mocks test/*.test.js`
- Coverage command: `npm run test:coverage` (thresholds: lines=90, branches=85, functions=90)
- Build verification: no TypeScript, no transpilation; use `node --check` (automated via smoke.test.js)
- No eslint config discovered; eslint is devDependency but no run script defined

## Problemas Recorrentes

- Commit message hygiene: ALL commits on node23-upgrade branch contain `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` or `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` — this is a hard gate violation (14 commits: 5fa3c5b through 1e017d0)
- file_size_analyzer.py is NOT present in this project (not at .agents/tools/file_size_analyzer.py or anywhere else) — must use manual count via grep
- test/commands.test.js has 355 effective lines (402 total), exceeding the 300-line threshold

## Critérios de Rejeição

- REJECTED_CODE (hygiene): Any commit containing `Co-Authored-By: Claude...` or `noreply@anthropic.com` trailers
  - Fix: `git filter-branch -f --msg-filter 'grep -v -i -E "^(Co-Authored-By: Claude|Co-Authored-By:.*anthropic)"' origin/master..HEAD`
  - Then: `git push --force-with-lease`
- REJECTED_CODE (file size): test/commands.test.js at 355 effective lines exceeds 300-line threshold; should be split by command family
- Note: The 9 `todo` tests are correct — they document known production bugs (shell injection, kill quoting, exit code) out of scope for this branch

## Stack & Ferramentas

- Node.js 23+ (ESM, native `node:test`, native `fetch`, `node:child_process`, `node:fs/promises`, `pathToFileURL`)
- `mock.module('node:child_process', ...)` for exec isolation (experimental, works in Node 23)
- `mock.method(globalThis, 'fetch', ...)` for fetch isolation
- `createSandbox()` in test/helpers/sandbox.js: creates tmpdir, changes cwd, cleans up — deterministic
- Test isolation is solid: no real shell commands executed in unit/integration tests; bin.test.js spawns real child processes by design (integration)
- Trivy scan: 0 CRITICAL, 0 HIGH, 0 MEDIUM vulnerabilities in both package-lock.json and yarn.lock (scanned 2026-10-23)
- SonarQube: not configured (SONARQUBE_URL/TOKEN env vars not set)

## Observações

- The `todo` mechanism in `node:test` causes "failing tests" to appear in the output but exit code remains 0 — this is expected behavior, not a test failure
- cli.js lines 72-73 uncovered are a known merge artifact; covered when tested in isolation
- bin/millbody branch 66.67% is the `?.` optional chaining fallback branch — acceptable, documented
- Coverage thresholds enforced at aggregate level (not per-file): aggregate passes all thresholds
- No Dockerfile, docker-compose, Terraform, or Kubernetes files — no IaC config scan needed
