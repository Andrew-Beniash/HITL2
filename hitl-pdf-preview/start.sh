#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Start the HITL PDF Preview app (server + client)
#
# Usage:
#   chmod +x start.sh
#   ./start.sh
#
# Prerequisites:
#   - Python 3.12+   (python3 --version)
#   - pip            (pip3 --version)
#   - Node.js 18+    (node --version)
#   - npm            (npm --version)
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[HITL]${NC} $*"; }
success() { echo -e "${GREEN}[HITL]${NC} $*"; }
warn()    { echo -e "${YELLOW}[HITL]${NC} $*"; }
error()   { echo -e "${RED}[HITL]${NC} $*"; exit 1; }

# Tracks how the server deps were installed: "venv" or "user"
INSTALL_MODE="venv"

# ── Dependency checks ─────────────────────────────────────────────────────────

check_python() {
  if ! command -v python3 &>/dev/null; then
    error "Python 3 not found. Install Python 3.12+ from https://python.org"
  fi
  PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  info "Python $PY_VER found"
}

check_node() {
  if ! command -v node &>/dev/null; then
    error "Node.js not found. Install Node.js 18+ from https://nodejs.org"
  fi
  NODE_VER=$(node --version)
  info "Node.js $NODE_VER found"
}

# ── Server setup ──────────────────────────────────────────────────────────────

# Attempt to create a healthy venv; returns 0 on success, 1 on failure.
try_create_venv() {
  # Remove a broken venv (directory exists but activate is missing)
  if [ -d ".venv" ] && [ ! -f ".venv/bin/activate" ]; then
    warn "Found incomplete venv — removing and recreating…"
    rm -rf .venv
  fi

  if [ ! -d ".venv" ]; then
    info "Creating Python virtual environment…"
    if ! python3 -m venv .venv 2>/dev/null; then
      warn "python3 -m venv failed, trying with --without-pip…"
      if ! python3 -m venv .venv --without-pip 2>/dev/null; then
        return 1
      fi
    fi
  fi

  # Final sanity check
  if [ ! -f ".venv/bin/activate" ]; then
    return 1
  fi
  return 0
}

setup_server() {
  info "Setting up Python server…"
  cd "$SERVER_DIR"

  if try_create_venv; then
    # ── venv path ──────────────────────────────────────────────────────────
    INSTALL_MODE="venv"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    info "Installing Python dependencies into venv…"
    # Ensure pip is available (needed when created with --without-pip)
    python3 -m ensurepip --upgrade 2>/dev/null || true
    pip install -q --upgrade pip 2>/dev/null || true
    pip install -q -r requirements.txt
  else
    # ── Fallback: user-level install ───────────────────────────────────────
    INSTALL_MODE="user"
    warn "venv unavailable — installing to user site-packages (~/.local)"
    warn "You may see 'not on PATH' warnings; they are harmless."
    pip3 install -q --user -r requirements.txt
    # Prepend ~/.local/bin so uvicorn is found
    export PATH="$HOME/.local/bin:$PATH"
  fi

  success "Server dependencies ready (mode: $INSTALL_MODE)"
  cd "$SCRIPT_DIR"
}

# ── Client setup ──────────────────────────────────────────────────────────────

setup_client() {
  info "Setting up React client…"
  cd "$CLIENT_DIR"

  # Detect stale node_modules (e.g. installed on a different OS/arch).
  # Symptoms: node_modules exists but platform-specific native binaries are missing.
  NEEDS_INSTALL=false
  if [ ! -d "node_modules" ]; then
    NEEDS_INSTALL=true
  elif ! node -e "require('./node_modules/rollup/dist/native.js')" 2>/dev/null; then
    warn "node_modules appear stale or built for a different platform — reinstalling…"
    rm -rf node_modules package-lock.json
    NEEDS_INSTALL=true
  fi

  if [ "$NEEDS_INSTALL" = true ]; then
    info "Installing Node.js dependencies (this may take a moment)…"
    npm install
  fi

  success "Client dependencies ready"
  cd "$SCRIPT_DIR"
}

# ── Start processes ───────────────────────────────────────────────────────────

start_server() {
  cd "$SERVER_DIR"

  if [ "$INSTALL_MODE" = "venv" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
    UVICORN_CMD="uvicorn"
  else
    export PATH="$HOME/.local/bin:$PATH"
    UVICORN_CMD="python3 -m uvicorn"
  fi

  info "Starting FastAPI server on http://localhost:8000"
  $UVICORN_CMD main:app --host 0.0.0.0 --port 8000 --reload &
  SERVER_PID=$!
  cd "$SCRIPT_DIR"
}

start_client() {
  cd "$CLIENT_DIR"
  info "Starting Vite dev server on http://localhost:5173"
  npm run dev &
  CLIENT_PID=$!
  cd "$SCRIPT_DIR"
}

cleanup() {
  echo ""
  info "Shutting down…"
  kill $SERVER_PID 2>/dev/null || true
  kill $CLIENT_PID 2>/dev/null || true
  success "Stopped"
}

# ── Main ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   HITL PDF Preview — Local Development Server     ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_python
check_node
setup_server
setup_client

trap cleanup INT TERM

start_server
sleep 2   # give the server a moment to start
start_client

echo ""
success "Both services are running!"
echo ""
echo -e "  ${GREEN}App:${NC}    http://localhost:5173"
echo -e "  ${GREEN}API:${NC}    http://localhost:8000"
echo -e "  ${GREEN}Docs:${NC}   http://localhost:8000/docs"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop both services"
echo ""

wait
