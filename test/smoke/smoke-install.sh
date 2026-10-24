#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSIONED_SHIMS="$REPO_ROOT/test/smoke/shims"

node_version="$(node -v 2>/dev/null || true)"
if [ -z "$node_version" ]; then
  echo "FALHA: node não encontrado no PATH" >&2
  exit 1
fi
case "$node_version" in
  v23*) ;;
  *)
    echo "FALHA: node deve ser v23.x, encontrado: $node_version" >&2
    exit 1
    ;;
esac

T="$(mktemp -d "${TMPDIR:-/tmp}/millbody-smoke.XXXXXX")"
SHIMDIR="$T/shimdir"
mkdir -p "$SHIMDIR"
cp "$VERSIONED_SHIMS/brew" "$VERSIONED_SHIMS/corepack" "$VERSIONED_SHIMS/gem" "$SHIMDIR/"
ln -sf "$(command -v node)" "$SHIMDIR/node"
ln -sf "$(command -v npm)" "$SHIMDIR/npm"
ln -sf "$(command -v git)" "$SHIMDIR/git"

SHIM_BREW_LOG="$T/shim-brew.log"
SHIM_COREPACK_LOG="$T/shim-corepack.log"
SHIM_GEM_LOG="$T/shim-gem.log"
export SHIM_BREW_LOG SHIM_COREPACK_LOG SHIM_GEM_LOG

touch "$SHIM_BREW_LOG" "$SHIM_COREPACK_LOG" "$SHIM_GEM_LOG"

cleanup() {
  if [ -n "${WATCHDOG_PID:-}" ]; then
    kill "$WATCHDOG_PID" 2>/dev/null || true
  fi
  rm -rf "$T"
}
trap cleanup EXIT INT TERM

(
  sleep 360
  echo "FALHA: watchdog smoke-install disparou (360s)" >&2
  kill $$ 2>/dev/null || true
) &
WATCHDOG_PID=$!

export PATH="$SHIMDIR:/usr/bin:/bin"

PACK_JSON="$(npm pack --pack-destination "$T" --json 2>/dev/null)"
TGZ_NAME="$(echo "$PACK_JSON" | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const arr = JSON.parse(chunks.join(''));
  process.stdout.write(arr[0].filename);
});
" <<< "$PACK_JSON")"
TGZ="$T/$TGZ_NAME"

if [ ! -f "$TGZ" ]; then
  echo "FALHA: tarball não encontrado em $T" >&2
  exit 1
fi

if tar -tzf "$TGZ" | grep -q "^test/"; then
  echo "FALHA: tarball inclui test/ (não deve ser publicado)" >&2
  exit 1
fi
if tar -tzf "$TGZ" | grep -q "^.qa-gate.json"; then
  echo "FALHA: tarball inclui .qa-gate.json (não deve ser publicado)" >&2
  exit 1
fi

mkdir -p "$T/home" "$T/prefix"
INIT_CWD_DIR="$(mktemp -d "$T/initcwd.XXXXXX")"

CI_VARS="CI CONTINUOUS_INTEGRATION GITHUB_ACTIONS TRAVIS CIRCLECI GITLAB_CI JENKINS_URL TEAMCITY_VERSION BUILDKITE DRONE"

npm_cmd="npm"
install_args="install -g $TGZ --prefix $T/prefix --prefer-offline"

env \
  -u MILLBODY_SKIP_SETUP \
  -u CI \
  -u CONTINUOUS_INTEGRATION \
  -u GITHUB_ACTIONS \
  -u TRAVIS \
  -u CIRCLECI \
  -u GITLAB_CI \
  -u JENKINS_URL \
  -u TEAMCITY_VERSION \
  -u BUILDKITE \
  -u DRONE \
  -u ANDROID_HOME \
  HOME="$T/home" \
  npm_config_userconfig="$T/npmrc" \
  npm_config_globalconfig="$T/gnpmrc" \
  npm_config_cache="$HOME/.npm" \
  npm_config_prefix="$T/prefix" \
  npm_config_update_notifier="false" \
  MILLBODY_SYSTEM_BIN_PATHS="" \
  npm_config_global="true" \
  bash -c "cd '$INIT_CWD_DIR' && npm install -g '$TGZ' --prefix '$T/prefix' --prefer-offline" || true

LOGFILE=""
PKG_LOG="$T/prefix/lib/node_modules/@millbody/millbody-cli/.millbody-postinstall.log"
if [ -f "$PKG_LOG" ]; then
  LOGFILE="$PKG_LOG"
else
  FALLBACK_LOG="$TMPDIR/.millbody-postinstall.log"
  if [ -z "${TMPDIR:-}" ]; then
    FALLBACK_LOG="/tmp/.millbody-postinstall.log"
  fi
  if [ -f "$FALLBACK_LOG" ]; then
    LOGFILE="$FALLBACK_LOG"
  fi
fi

if [ -z "$LOGFILE" ]; then
  echo "FALHA: log do postinstall não encontrado" >&2
  echo "Conteúdo de $T/prefix:" >&2
  find "$T/prefix" -type f 2>/dev/null | head -30 >&2 || true
  exit 1
fi

echo "=== LOG POSTINSTALL ===" >&2
cat "$LOGFILE" >&2
echo "=== SHIM BREW LOG ===" >&2
cat "$SHIM_BREW_LOG" >&2
echo "=== SHIM COREPACK LOG ===" >&2
cat "$SHIM_COREPACK_LOG" >&2

if grep -q "pulando setup" "$LOGFILE"; then
  echo "FALHA: setup foi pulado mas não deveria ser" >&2
  exit 1
fi

if ! grep -q "setup concluído" "$LOGFILE"; then
  if grep -q "Não foi possível detectar a arquitetura" "$LOGFILE"; then
    echo "FALHA PRÉ-FIX CONFIRMADA: log contém 'Não foi possível detectar a arquitetura' e não contém 'setup concluído'" >&2
    echo "CA02: smoke falhou corretamente no código pré-fix" >&2
    exit 1
  fi
  if grep -q "erro:" "$LOGFILE"; then
    echo "FALHA: log contém 'erro:' mas não contém 'setup concluído'" >&2
    cat "$LOGFILE" >&2
    exit 1
  fi
  echo "FALHA: log não contém 'setup concluído'" >&2
  cat "$LOGFILE" >&2
  exit 1
fi

if grep -q "erro:" "$LOGFILE"; then
  echo "FALHA: log contém 'erro:'" >&2
  cat "$LOGFILE" >&2
  exit 1
fi

if [ ! -s "$SHIM_BREW_LOG" ]; then
  echo "FALHA: shim-brew-log está vazio — canário: brew real pode ter sido usado ou nenhum install brew foi chamado" >&2
  exit 1
fi

if ! grep -q "install watchman" "$SHIM_BREW_LOG"; then
  echo "FALHA: shim-brew-log não contém 'install watchman' (expo)" >&2
  cat "$SHIM_BREW_LOG" >&2
  exit 1
fi

if ! grep -q "install cocoapods" "$SHIM_BREW_LOG"; then
  echo "FALHA: shim-brew-log não contém 'install cocoapods' (expo)" >&2
  cat "$SHIM_BREW_LOG" >&2
  exit 1
fi

if ! grep -q "install fastlane" "$SHIM_BREW_LOG"; then
  echo "FALHA: shim-brew-log não contém 'install fastlane' (legacy)" >&2
  cat "$SHIM_BREW_LOG" >&2
  exit 1
fi

if [ ! -s "$SHIM_COREPACK_LOG" ]; then
  echo "FALHA: shim-corepack-log está vazio — corepack deve ter sido chamado para yarn (expo)" >&2
  exit 1
fi

echo "smoke-install: PASSOU"
echo "setup concluído, brew log: $(cat "$SHIM_BREW_LOG"), corepack log: $(cat "$SHIM_COREPACK_LOG")"
