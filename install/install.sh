#!/usr/bin/env bash
# Vukoli installer for macOS (Linux: same flow, best effort).
#
#   curl -fsSL https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/VladPolyakov-art/vukoli/main/install/install.sh | bash -s -- --yes
#
# Options (env var in brackets):
#   --from <zip-or-dir>   use a local archive or unpacked folder instead of downloading the release [VUKOLI_FROM]
#   --yes                 accept the defaults, ask nothing                                           [VUKOLI_YES=1]
#                         The installer asks nothing about AI: the engine (Ollama, Claude Code, Codex, an API key)
#                         and its model are set up in the app.
#   --no-ollama           kept for old scripts; does nothing now                                     [VUKOLI_NO_OLLAMA=1]
#   --no-models           skip speech models (Kokoro, Whisper)                                       [VUKOLI_NO_MODELS=1]
#   --no-launch           do not start the app or open its window at the end                         [VUKOLI_NO_LAUNCH=1]
#   --prefix <dir>        install location (default ~/.vukoli)                                       [VUKOLI_PREFIX]
#   --uninstall [--purge] remove the app and launchers; --purge also deletes your sessions and data
#   -h, --help
# The app opens in its own window (Chrome / Edge / Chromium / Brave app mode); VUKOLI_APP_WINDOW=0 opens a browser tab instead.
# Test switch: VUKOLI_APP_DIR=<dir> puts Vukoli.app there instead of ~/Applications (tests).
#
# No administrator rights are needed. Everything lives in the install folder and ~/Applications/Vukoli.app.
# Run the same command again to resume or upgrade.

set -euo pipefail

RELEASE_URL_DEFAULT="https://github.com/VladPolyakov-art/vukoli/releases/latest/download/vukoli.zip"
UV_INSTALLER_URL="https://astral.sh/uv/install.sh"
OLLAMA_MAC_URL="https://ollama.com/download/Ollama-darwin.zip"
OLLAMA_API="http://127.0.0.1:11434"
KOKORO_BASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
PYTHON_VERSION="3.12"
AGENT_LABEL="com.vukoli.ollama"
TOTAL_STEPS=6

# ---------------------------------------------------------------- options
FROM="${VUKOLI_FROM:-}"
YES="${VUKOLI_YES:-0}"
NO_OLLAMA="${VUKOLI_NO_OLLAMA:-0}"
NO_MODELS="${VUKOLI_NO_MODELS:-0}"
NO_LAUNCH="${VUKOLI_NO_LAUNCH:-0}"
PREFIX="${VUKOLI_PREFIX:-$HOME/.vukoli}"
RELEASE_URL="${VUKOLI_URL:-$RELEASE_URL_DEFAULT}"
DRY="${VUKOLI_DRY_RUN:-0}"
UNINSTALL=0
PURGE=0

usage() { sed -n 2,23p "$0" 2>/dev/null | sed 's/^# \{0,1\}//' || true; }

while [ $# -gt 0 ]; do
  case "$1" in
    --from) [ $# -ge 2 ] || { echo "--from needs a path" >&2; exit 2; }; FROM="$2"; shift ;;
    --from=*) FROM="${1#--from=}" ;;
    --yes|-y) YES=1 ;;
    --no-ollama) NO_OLLAMA=1 ;;
    --no-models) NO_MODELS=1 ;;
    --no-launch) NO_LAUNCH=1 ;;
    --prefix) [ $# -ge 2 ] || { echo "--prefix needs a folder" >&2; exit 2; }; PREFIX="$2"; shift ;;
    --prefix=*) PREFIX="${1#--prefix=}" ;;
    --uninstall) UNINSTALL=1 ;;
    --purge) PURGE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
  shift
done

# ---------------------------------------------------------------- output helpers
say() { printf '%s\n' "$*"; }
note() { printf '    %s\n' "$*"; }
step() { CURRENT_STEP="$2"; printf '\n[%s/%s] %s\n' "$1" "$TOTAL_STEPS" "$2"; }
warn() { printf '    ! %s\n' "$*" >&2; }

FAIL_SHOWN=0
CURRENT_STEP=""
fail() {   # fail "what happened" "what to do next"
  FAIL_SHOWN=1
  printf '\nVukoli install stopped at step "%s".\n  %s\n' "${CURRENT_STEP:-start}" "$1" >&2
  if [ -n "${2:-}" ]; then printf '  Next: %s\n' "$2" >&2; fi
  printf '  Run the same install command again: finished steps are skipped.\n' >&2
  exit 1
}
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$FAIL_SHOWN" = 0 ]; then
    printf '\nVukoli install stopped at step "%s" (exit code %s). Check the message above, then run the same install command again: finished steps are skipped.\n' "${CURRENT_STEP:-start}" "$rc" >&2
  fi
}
trap on_exit EXIT
trap 'FAIL_SHOWN=1; printf "\nStopped. Run the same install command again to continue.\n" >&2; exit 130' INT TERM

fmt_secs() {
  local s=$1
  if [ "$s" -ge 3600 ]; then printf '%d h %d min' $((s / 3600)) $(((s % 3600) / 60))
  elif [ "$s" -ge 60 ]; then printf '%d min %d s' $((s / 60)) $((s % 60))
  else printf '%d s' "$s"; fi
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
have() { command -v "$1" >/dev/null 2>&1; }
have_tty() { { : </dev/tty; } 2>/dev/null; }

ask_yn() {   # ask_yn "question" y|n  -> 0 = yes
  local q="$1" def="$2" hint ans=""
  if [ "$YES" = 1 ]; then say "    $q -> yes (--yes)"; return 0; fi
  if [ "$def" = y ]; then hint="Y/n"; else hint="y/N"; fi
  if have_tty; then
    printf '    %s [%s] ' "$q" "$hint" >/dev/tty
    read -r ans </dev/tty || ans=""
  else
    say "    $q -> $def (no terminal to ask on; using the default. Use --yes to accept all defaults)"
    ans="$def"
  fi
  [ -n "$ans" ] || ans="$def"
  case "$(lower "$ans")" in y|yes) return 0 ;; *) return 1 ;; esac
}

CHOICE=""
ask_choice() {   # ask_choice "question" default "option 1" "option 2" ... -> sets CHOICE to the chosen number
  local q="$1" def="$2" i=1 ans="" n
  shift 2
  n=$#
  say "    $q"
  for o in "$@"; do say "      $i) $o"; i=$((i + 1)); done
  if [ "$YES" = 1 ]; then say "    -> $def (--yes)"; CHOICE="$def"; return 0; fi
  if ! have_tty; then
    say "    -> $def (no terminal to ask on; using the default. Use --yes to accept all defaults)"
    CHOICE="$def"; return 0
  fi
  while :; do
    printf '    Type a number and press Return [%s] ' "$def" >/dev/tty
    read -r ans </dev/tty || ans=""
    [ -n "$ans" ] || ans="$def"
    case "$ans" in
      *[!0-9]*) ;;
      *) if [ "$ans" -ge 1 ] && [ "$ans" -le "$n" ]; then CHOICE="$ans"; return 0; fi ;;
    esac
    printf '    Please type a number from 1 to %s.\n' "$n" >/dev/tty
  done
}

act() {   # side effects of the Ollama step; VUKOLI_DRY_RUN=1 only prints them
  if [ "$DRY" = 1 ]; then say "    [dry-run] $*"; return 0; fi
  "$@"
}

sha256() {
  if have shasum; then shasum -a 256 "$1" | cut -d' ' -f1
  elif have sha256sum; then sha256sum "$1" | cut -d' ' -f1
  else openssl dgst -sha256 "$1" | sed 's/^.*= //'; fi
}

# curl download with progress and resume. dl <url> <dest>
dl() {
  local url="$1" dest="$2" part="$2.part" quiet="-sS"
  [ -t 2 ] && quiet="-#"
  mkdir -p "$(dirname "$dest")"
  if ! curl -fL --retry 3 --connect-timeout 20 -C - $quiet -o "$part" "$url" 2>&1; then
    rm -f "$part"
    curl -fL --retry 3 --connect-timeout 20 $quiet -o "$part" "$url" || return 1
  fi
  mv -f "$part" "$dest"
}

remote_size() {   # bytes of the final file behind a URL (follows redirects), or empty
  curl -fsIL --max-time 20 "$1" 2>/dev/null | tr -d '\r' | awk 'tolower($1)=="content-length:" {v=$2} END {print v}' || true
}

mb() { awk -v b="${1:-0}" 'BEGIN { printf "%.0f", b / 1048576 }'; }

# ---------------------------------------------------------------- state file (resume)
STATE=""
state_get() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" | tail -n 1 || true; }
state_set() {
  local tmp="$STATE.tmp"
  mkdir -p "$(dirname "$STATE")"
  { [ -f "$STATE" ] && grep -v "^$1=" "$STATE" || true; printf '%s=%s\n' "$1" "$2"; } >"$tmp"
  mv -f "$tmp" "$STATE"
}
is_done() { [ "$(state_get "$1")" = "$2" ]; }

# ---------------------------------------------------------------- platform
OS="$(uname -s)"
ARCH="$(uname -m)"
IS_MAC=0
[ "$OS" = Darwin ] && IS_MAC=1

abs_path() {
  # shellcheck disable=SC2088  # the patterns are a literal "~" typed by the user; expanded by hand below
  case "$1" in
    '~') printf '%s' "$HOME" ;;
    '~/'*) printf '%s/%s' "$HOME" "${1#\~/}" ;;
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "$(pwd)" "$1" ;;
  esac
}
PREFIX="$(abs_path "$PREFIX")"
PREFIX="${PREFIX%/}"
[ -n "$PREFIX" ] || { echo "Install folder is empty." >&2; exit 2; }
[ -z "$FROM" ] || FROM="$(abs_path "$FROM")"
STATE="$PREFIX/install-state"
APPDIR="$PREFIX/app"
VENV="$PREFIX/venv"
VPY="$VENV/bin/python"
UVDIR="$PREFIX/uv"
UV="$UVDIR/uv"
DLDIR="$PREFIX/.download"
BIN="$PREFIX/bin/vukoli"
LAUNCH_APP="${VUKOLI_APP_DIR:-$HOME/Applications}/Vukoli.app"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
AGENT_PLIST="$HOME/Library/LaunchAgents/$AGENT_LABEL.plist"

total_ram_mb() {
  if [ "$IS_MAC" = 1 ]; then echo $(( $(sysctl -n hw.memsize) / 1048576 ))
  elif [ -r /proc/meminfo ]; then awk '/MemTotal/ {printf "%d", $2 / 1024}' /proc/meminfo
  else echo 8192; fi
}

free_mb() {   # free space on the disk that will hold $1
  local d="$1"
  while [ ! -d "$d" ] && [ "$d" != "/" ]; do d="$(dirname "$d")"; done
  df -Pk "$d" | awk 'NR == 2 {printf "%d", $4 / 1024}'
}

# ---------------------------------------------------------------- Ollama helpers
ollama_up() { curl -fsS --max-time 2 "$OLLAMA_API/api/version" >/dev/null 2>&1; }

find_ollama_app() {
  [ "${VUKOLI_TEST_HIDE_OLLAMA:-0}" != 1 ] || return 1   # test switch: pretend Ollama is not installed
  local p
  for p in /Applications/Ollama.app "$HOME/Applications/Ollama.app"; do
    if [ -d "$p" ]; then printf '%s' "$p"; return 0; fi
  done
  return 1
}

find_ollama_cli() {
  [ "${VUKOLI_TEST_HIDE_OLLAMA:-0}" != 1 ] || return 1
  local p app
  if have ollama; then command -v ollama; return 0; fi
  for p in /usr/local/bin/ollama /opt/homebrew/bin/ollama; do
    if [ -x "$p" ]; then printf '%s' "$p"; return 0; fi
  done
  if app="$(find_ollama_app)" && [ -x "$app/Contents/Resources/ollama" ]; then
    printf '%s' "$app/Contents/Resources/ollama"; return 0
  fi
  return 1
}

foreign_ollama_agent() {   # an Ollama login item / service that is not ours
  local f
  for f in "$HOME"/Library/LaunchAgents/*[Oo]llama*.plist; do
    [ -e "$f" ] || continue
    [ "$f" = "$AGENT_PLIST" ] && continue
    printf '%s' "$f"; return 0
  done
  return 1
}

stop_server_if_running() {
  if [ -x "$BIN" ]; then "$BIN" stop >/dev/null 2>&1 </dev/null || true; fi
}

# ---------------------------------------------------------------- uninstall
do_uninstall() {
  say "Uninstalling Vukoli from $PREFIX"
  local data_dir=""
  if [ -x "$VPY" ] && [ -d "$APPDIR/server/server" ]; then
    data_dir="$("$VPY" -I -c "import sys; sys.path.insert(0, sys.argv[1]); from server import config; print(config.data_dir())" "$APPDIR/server" 2>/dev/null || true)"
  fi
  stop_server_if_running
  if [ -f "$AGENT_PLIST" ]; then
    launchctl bootout "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1 || true
    rm -f "$AGENT_PLIST"
    say "  Removed the login agent that started Ollama with your computer ($AGENT_LABEL). Ollama itself is still installed."
  fi
  if [ -d "$LAUNCH_APP" ] && grep -q "com.vukoli.launcher" "$LAUNCH_APP/Contents/Info.plist" 2>/dev/null; then
    "$LSREGISTER" -u "$LAUNCH_APP" >/dev/null 2>&1 || true   # forget the vukoli:// link
    rm -rf "$LAUNCH_APP"; say "  Removed $LAUNCH_APP"
  fi
  rm -f "$HOME/.local/share/applications/vukoli.desktop" 2>/dev/null || true
  local d
  for d in app venv python uv cache logs bin browser .download .stage; do
    if [ -e "$PREFIX/$d" ]; then rm -rf "${PREFIX:?}/$d"; fi
  done
  rm -f "$PREFIX/install-state" "$PREFIX/install-state.tmp" "$PREFIX/server.pid"
  rmdir "$PREFIX" 2>/dev/null || true
  say "  Removed the app, Python and launchers."
  if [ "$PURGE" = 1 ]; then
    if [ -z "$data_dir" ]; then
      say "  Could not find your data folder (the app was already removed). It is usually ~/Library/Application Support/interview-coach."
    elif [ -d "$data_dir" ]; then
      if ask_yn "Delete your sessions, settings and speech models in $data_dir?" n; then
        rm -rf "$data_dir"; say "  Deleted $data_dir"
      else
        say "  Kept $data_dir"
      fi
    fi
    say "  The Whisper model is in the shared Hugging Face cache (~/.cache/huggingface); other programs may use it, so it was kept."
  else
    say "  Your sessions and settings were kept${data_dir:+ in $data_dir}. Add --purge to delete them."
  fi
  say "  Ollama and its models were not touched. To remove Ollama: quit it, delete Ollama.app from Applications, then run: rm -rf ~/.ollama"
  say "Done."
}

if [ "$UNINSTALL" = 1 ]; then
  do_uninstall
  exit 0
fi

# ================================================================ install
START_SECS=$SECONDS
MODEL_SECS=0
OLLAMA_CLI=""
OLLAMA_APP=""
OLLAMA_STATUS="not set up"
SPEECH_STATUS="not set up"
AGENT_STATUS="none"
VERSION_INSTALLED=""

# ---------------------------------------------------------------- 1. preflight
step 1 "Check this computer"
case "$OS" in
  Darwin)
    macver="$(sw_vers -productVersion 2>/dev/null || echo 0)"
    macmajor="${macver%%.*}"
    note "macOS $macver, $ARCH"
    [ "${macmajor:-0}" -ge 12 ] 2>/dev/null || fail "macOS 12 or newer is needed (this is $macver)." "Update macOS, or use another computer."
    ;;
  Linux) note "Linux $ARCH (best effort: macOS is the tested path)" ;;
  *) fail "This installer is for macOS and Linux (found $OS). On Windows use install.ps1." "See the Install section of the README." ;;
esac
case "$ARCH" in arm64|aarch64|x86_64|amd64) ;; *) fail "Unsupported processor: $ARCH." "Vukoli needs an Intel/AMD or Apple Silicon computer." ;; esac
for tool in curl unzip awk sed tr; do
  have "$tool" || fail "The program '$tool' is missing." "Install it and run the command again."
done

RAM_MB="$(total_ram_mb)"
FREE_MB="$(free_mb "$PREFIX")"
NEED_MB=2048
[ "$NO_MODELS" = 1 ] || NEED_MB=$((NEED_MB + 1536))
note "Memory: $((RAM_MB / 1024)) GB. Free disk space: $((FREE_MB / 1024)) GB."
note "Space needed: app + Python about 1.5 GB$( [ "$NO_MODELS" = 1 ] || printf ', speech models about 1 GB' )$( [ "$NO_OLLAMA" = 1 ] || printf '; a local AI model, if you choose one in the app, needs 2.5 to 5 GB more' )."
if [ "$FREE_MB" -lt "$NEED_MB" ]; then
  fail "Not enough free disk space: $((FREE_MB / 1024)) GB free, about $((NEED_MB / 1024)) GB needed." "Free some space (or use --prefix on a bigger disk) and run the command again."
fi
if ! mkdir -p "$PREFIX" 2>/dev/null || [ ! -w "$PREFIX" ]; then
  fail "Cannot write to $PREFIX." "Choose a folder you own with --prefix <folder>."
fi
if ! curl -fsS --max-time 15 -o /dev/null -I https://pypi.org/simple/ 2>/dev/null; then
  fail "No network (could not reach pypi.org)." "Check your internet connection (or proxy) and run the command again."
fi
if [ -z "$FROM" ] && ! curl -fsS --max-time 15 -o /dev/null -I https://github.com 2>/dev/null; then
  fail "No network (could not reach github.com)." "Check your internet connection and run the command again."
fi
note "No administrator password is needed."
if [ -f "$STATE" ]; then
  if [ "$(state_get complete)" = 1 ]; then note "Vukoli is already installed here: checking for updates and repairing if needed."
  else note "Continuing an earlier install: finished steps are skipped."; fi
fi
state_set complete 0

# ---------------------------------------------------------------- 2. get the app
step 2 "Get the app"
mkdir -p "$DLDIR"
SRC_FP=""
SRC_DIR=""
STAGE="$PREFIX/.stage"
if [ -n "$FROM" ]; then
  if [ -d "$FROM" ]; then
    SRC_DIR="$FROM"
    if [ ! -d "$SRC_DIR/server" ] && [ -d "$SRC_DIR/vukoli/server" ]; then SRC_DIR="$SRC_DIR/vukoli"; fi
    [ -d "$SRC_DIR/server" ] || fail "$FROM has no server/ folder." "Point --from at vukoli.zip or the unpacked vukoli folder."
    SRC_FP="dir-$(date +%s)"
    note "Using folder $FROM"
  elif [ -f "$FROM" ]; then
    ZIP="$FROM"
    SRC_FP="$(sha256 "$ZIP")"
    note "Using $FROM ($(mb "$(wc -c <"$ZIP")") MB)"
  else
    fail "$FROM does not exist." "Check the path given to --from."
  fi
else
  ZIP="$DLDIR/vukoli.zip"
  size="$(remote_size "$RELEASE_URL")"
  note "Downloading the app$( [ -n "$size" ] && printf ' (%s MB)' "$(mb "$size")" ) from $RELEASE_URL"
  dl "$RELEASE_URL" "$ZIP" || fail "Could not download the app from $RELEASE_URL." "Check your internet connection. If the project has no release yet, use --from <vukoli.zip>."
  sums="$DLDIR/SHA256SUMS"
  if curl -fsSL --max-time 30 -o "$sums" "${RELEASE_URL%/*}/SHA256SUMS" 2>/dev/null; then
    expect="$(awk '$2 == "vukoli.zip" || $2 == "*vukoli.zip" {print $1}' "$sums" | head -n 1)"
    actual="$(sha256 "$ZIP")"
    if [ -n "$expect" ] && [ "$expect" != "$actual" ]; then
      rm -f "$ZIP"
      fail "The downloaded file does not match its checksum (SHA256SUMS)." "Run the command again; if it keeps failing, report it on the project page."
    fi
    note "Checksum OK."
  else
    warn "SHA256SUMS not found next to the download; skipping the checksum check."
  fi
  SRC_FP="$(sha256 "$ZIP")"
fi

if is_done app_fp "$SRC_FP" && [ -d "$APPDIR/server/server" ] && [ -d "$APPDIR/web/dist" ]; then
  note "App is already up to date (version $(cat "$APPDIR/VERSION" 2>/dev/null || echo '?')): skipped."
else
  rm -rf "$STAGE"; mkdir -p "$STAGE"
  if [ -n "$SRC_DIR" ]; then
    cp -R "$SRC_DIR/." "$STAGE/" || fail "Could not copy $SRC_DIR." "Check the folder and run the command again."
    NEWAPP="$STAGE"
  else
    unzip -q -o "$ZIP" -d "$STAGE" || fail "Could not unpack the archive." "Delete $DLDIR and run the command again."
    if [ -d "$STAGE/vukoli/server" ]; then NEWAPP="$STAGE/vukoli"; else NEWAPP="$STAGE"; fi
  fi
  [ -d "$NEWAPP/server/server" ] && [ -f "$NEWAPP/web/dist/index.html" ] || fail "The archive is missing the server or the web app." "Build it with install/build_release.py, or download the release again."
  stop_server_if_running
  rm -rf "$PREFIX/app.old"
  [ ! -d "$APPDIR" ] || mv "$APPDIR" "$PREFIX/app.old"
  mv "$NEWAPP" "$APPDIR"
  rm -rf "$PREFIX/app.old" "$STAGE"
  chmod +x "$APPDIR"/install/*.sh "$APPDIR/install/macos/vukoli" "$APPDIR/install/macos/Vukoli.app/Contents/MacOS/"* 2>/dev/null || true
  state_set app_fp "$SRC_FP"
  note "App unpacked to $APPDIR (version $(cat "$APPDIR/VERSION" 2>/dev/null || echo '?'))."
fi
VERSION_INSTALLED="$(cat "$APPDIR/VERSION" 2>/dev/null || echo '?')"

# ---------------------------------------------------------------- 3. Python
step 3 "Install Python and the app's libraries (private copy, your other Python is not touched)"
export UV_PYTHON_INSTALL_DIR="$PREFIX/python"
export UV_CACHE_DIR="$PREFIX/cache"
export UV_PYTHON_PREFERENCE=only-managed
export UV_NO_MODIFY_PATH=1
if [ ! -x "$UV" ]; then
  note "Getting uv (the Python installer, about 20 MB) from astral.sh"
  curl -fsSL --retry 3 -o "$DLDIR/uv-install.sh" "$UV_INSTALLER_URL" || fail "Could not download the uv installer from $UV_INSTALLER_URL." "Check your internet connection and run the command again."
  mkdir -p "$UVDIR"
  UV_INSTALL_DIR="$UVDIR" UV_NO_MODIFY_PATH=1 INSTALLER_NO_MODIFY_PATH=1 sh "$DLDIR/uv-install.sh" </dev/null || fail "The uv installer failed." "Run the command again."
  [ -x "$UV" ] || fail "uv was not installed to $UVDIR." "Run the command again; if it keeps failing, report it on the project page."
else
  note "uv found: skipped."
fi
if is_done venv "$PYTHON_VERSION" && [ -x "$VPY" ] && "$VPY" -c "import sys" >/dev/null 2>&1; then
  note "Python $PYTHON_VERSION found: skipped."
else
  note "Python $PYTHON_VERSION (about 30 MB download)"
  "$UV" venv --python "$PYTHON_VERSION" --clear "$VENV" </dev/null || fail "Could not set up Python $PYTHON_VERSION." "Check your internet connection and free disk space, then run the command again."
  state_set venv "$PYTHON_VERSION"
  state_set reqs ""
fi
REQ_FP="$(sha256 "$APPDIR/server/requirements.txt")"
if is_done reqs "$REQ_FP"; then
  note "Libraries are already installed: skipped."
else
  note "Libraries from requirements.txt (about 0.5 to 1 GB, speech engines included)"
  uvq=""
  [ -t 2 ] || uvq="--quiet"   # no terminal (CI, logs): skip the long package list
  # shellcheck disable=SC2086
  "$UV" pip install $uvq --python "$VPY" -r "$APPDIR/server/requirements.txt" </dev/null \
    || fail "Installing the app's libraries failed." "Check your internet connection and free disk space, then run the command again."
  "$VPY" -I -c "import fastapi, uvicorn, kokoro_onnx" 2>/dev/null || fail "The libraries were installed but do not import." "Run the command again; if it keeps failing, report it on the project page."
  state_set reqs "$REQ_FP"
fi

# helper for the steps below (talks to the app's own code, so the choices stay in sync with it)
HELPER="$DLDIR/helper.py"
cat >"$HELPER" <<'PY'
import sys
cmd, server = sys.argv[1], sys.argv[2]
sys.path.insert(0, server)
if cmd == "kokoro-dir":
    from server import config
    print(config.kokoro_model_dir())
elif cmd == "whisper-info":
    from server import stt
    backend = stt.choose_backend("auto")
    print(f"{backend} {stt.default_model(backend)}" if backend else "none")
elif cmd == "whisper-fetch":
    backend, model = sys.argv[3], sys.argv[4]
    if backend == "mlx":
        from huggingface_hub import snapshot_download
        snapshot_download(model)
    else:
        from faster_whisper.utils import download_model
        download_model(model)
else:
    sys.exit("unknown command")
PY
pyhelper() { "$VPY" -I "$HELPER" "$1" "$APPDIR/server" "${@:2}"; }

# ---------------------------------------------------------------- 4. speech models
step 4 "Speech models (Mike's voice: Kokoro, your voice: Whisper)"
if [ "$NO_MODELS" != 1 ]; then
  KDIR="$(pyhelper kokoro-dir)" || fail "Could not find the folder for speech models." "Run the command again."
  winfo="$(pyhelper whisper-info)" || fail "Could not check the speech recognition engine." "Run the command again."
fi
if [ "$NO_MODELS" = 1 ]; then
  note "Skipped (--no-models). The app works with typed answers until you add them."
  SPEECH_STATUS="not downloaded (typed answers)"
else
  t0=$SECONDS
  mkdir -p "$KDIR"
  for f in kokoro-v1.0.onnx voices-v1.0.bin; do
    want="$(remote_size "$KOKORO_BASE/$f")"
    have_size=0
    [ -f "$KDIR/$f" ] && have_size="$(wc -c <"$KDIR/$f" | tr -d ' ')"
    if [ -f "$KDIR/$f" ] && { [ -z "$want" ] || [ "$have_size" = "$want" ]; }; then
      note "$f is already there: skipped."
      continue
    fi
    note "Kokoro: $f$( [ -n "$want" ] && printf ' (%s MB)' "$(mb "$want")" )"
    dl "$KOKORO_BASE/$f" "$KDIR/$f" || fail "Could not download $f." "Check your internet connection and run the command again; the download resumes."
    if [ -n "$want" ] && [ "$(wc -c <"$KDIR/$f" | tr -d ' ')" != "$want" ]; then
      rm -f "$KDIR/$f"
      fail "$f was not downloaded completely." "Run the command again."
    fi
  done
  wbackend="${winfo%% *}"
  wmodel="${winfo#* }"
  if [ "$wbackend" = none ]; then
    note "No speech recognition engine is installed here: skipped. The app works with typed answers."
  elif is_done whisper "$winfo"; then
    note "Whisper ($wmodel) is already downloaded: skipped."
  else
    case "$wmodel" in
      *turbo*) wsize="about 1.6 GB" ;;
      small.en) wsize="about 0.5 GB" ;;
      base.en) wsize="about 0.15 GB" ;;
      *) wsize="a few hundred MB" ;;
    esac
    note "Whisper: $wmodel via $wbackend ($wsize), saved in the Hugging Face cache"
    pyhelper whisper-fetch "$wbackend" "$wmodel" </dev/null || fail "Could not download the Whisper model $wmodel." "Check your internet connection and run the command again; the download resumes."
    state_set whisper "$winfo"
  fi
  MODEL_SECS=$((MODEL_SECS + SECONDS - t0))
  note "Speech models ready in $(fmt_secs $((SECONDS - t0)))."
  SPEECH_STATUS="Kokoro voice + $( [ "$wbackend" = none ] && printf 'no speech recognition' || printf 'Whisper %s' "$wmodel" ) (in $KDIR and the Hugging Face cache)"
fi

# ---------------------------------------------------------------- 5. launchers
step 5 "Create the launchers"
mkdir -p "$PREFIX/bin" "$PREFIX/logs"
cp "$APPDIR/install/macos/vukoli" "$BIN" || fail "The launcher is missing from the archive." "Download the release again."
chmod +x "$BIN"
note "Command: $BIN (start, stop, status, logs)"
if [ "$IS_MAC" = 1 ]; then
  mkdir -p "$(dirname "$LAUNCH_APP")"
  rm -rf "$LAUNCH_APP"
  cp -R "$APPDIR/install/macos/Vukoli.app" "$LAUNCH_APP"
  printf '%s' "$PREFIX" >"$LAUNCH_APP/Contents/Resources/prefix"
  chmod +x "$LAUNCH_APP/Contents/MacOS/Vukoli"
  touch "$LAUNCH_APP"
  # Register the app (and its vukoli:// link, used by "Start Vukoli" on the page an installed, closed app shows).
  "$LSREGISTER" -f "$LAUNCH_APP" >/dev/null 2>&1 || true
  note "App icon: $LAUNCH_APP (Launchpad, Spotlight or the Applications folder in your home folder)."
else
  mkdir -p "$HOME/.local/share/applications"
  cat >"$HOME/.local/share/applications/vukoli.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Vukoli
Comment=Practise job interviews out loud
Exec=$BIN start
Terminal=false
Categories=Education;
DESKTOP
  note "Menu entry: Vukoli"
fi
state_set complete 1
rm -rf "$DLDIR"

# ---------------------------------------------------------------- 6. start
step 6 "Open the app"
if [ "$NO_LAUNCH" = 1 ]; then
  note "Skipped (--no-launch)."
else
  "$BIN" start </dev/null || fail "The app did not start." "Look at the log: $PREFIX/logs/server.log, then run the command again."
fi

TOTAL=$((SECONDS - START_SECS))
say ""
say "Vukoli $VERSION_INSTALLED is installed."
say "  Install folder : $PREFIX"
say "  Window         : Vukoli opens in its own window (Chrome or Edge app mode; the app offers to install itself for its own Dock icon); other browsers get a normal tab."
say "  Start later    : open Vukoli from Launchpad / Applications (in your home folder), or run: $BIN"
say "  Stop           : $BIN stop"
say "  Uninstall      : bash $APPDIR/install/install.sh --uninstall   (add --purge to delete your sessions too)"
say "  AI engine      : choose it in the app (first-run setup, or Settings > AI engine): Ollama with a local model,"
say "                   Claude Code, Codex or an API key. The app links to the Ollama download and downloads the model."
say "  Voice          : $SPEECH_STATUS"
say ""
say "What the installer created on this computer:"
say "  - $PREFIX : the app, its own Python and logs"
say "  - $BIN : the command to start and stop Vukoli"
if [ "$IS_MAC" = 1 ]; then say "  - $LAUNCH_APP : the Vukoli icon (Launchpad, Spotlight)"
else say "  - $HOME/.local/share/applications/vukoli.desktop : the menu entry"; fi
say "  Remove all of it: bash $APPDIR/install/install.sh --uninstall (your sessions stay unless you add --purge;"
say "  Ollama, if you install it from the app, is a separate program: delete Ollama.app to remove it)."
say "  Time           : total $(fmt_secs "$TOTAL"); speech model downloads $(fmt_secs "$MODEL_SECS"); the rest $(fmt_secs $((TOTAL - MODEL_SECS)))"
