#!/usr/bin/env bash

# IELTSmate 一键启动脚本
# 用法:
#   bash ./start.sh
# 或:
#   chmod +x ./start.sh && ./start.sh

set -u
set -o pipefail

PROJECT_DIR="/home/pdm/DEV/ieltsmate"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

BACKEND_LOG="/tmp/ieltsmate-backend.log"
FRONTEND_LOG="/tmp/ieltsmate-frontend.log"

DB_HOST="127.0.0.1"
DB_PORT="5432"
BACKEND_PORT="3000"
FRONTEND_PORT="5173"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_ok() {
  echo -e "${GREEN}  ✓ $1${NC}"
}

print_warn() {
  echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_err() {
  echo -e "${RED}  ✗ $1${NC}"
}

print_info() {
  echo -e "${CYAN}  → $1${NC}"
}

port_is_open() {
  local port="$1"
  ss -tln 2>/dev/null | grep -q ":${port} "
}

wait_for_port() {
  local port="$1"
  local retry="$2"
  local i=1
  while [ "$i" -le "$retry" ]; do
    if port_is_open "$port"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}  ║        IELTSmate 一键启动脚本        ║${NC}"
echo -e "${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: PostgreSQL ──────────────────────────────────────────
echo -e "${YELLOW}[1/3] 检查 PostgreSQL...${NC}"
if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
  print_ok "PostgreSQL 已在运行 (${DB_HOST}:${DB_PORT})"
else
  print_info "尝试启动 PostgreSQL 服务..."
  if sudo -n service postgresql start >/dev/null 2>&1; then
    :
  else
    print_warn "需要 sudo 权限启动数据库，可能会提示输入密码"
    if ! sudo service postgresql start >/dev/null 2>&1; then
      print_err "PostgreSQL 启动失败"
    fi
  fi

  if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    print_ok "PostgreSQL 启动成功 (${DB_HOST}:${DB_PORT})"
  else
    print_err "PostgreSQL 未就绪，请检查: sudo service postgresql status"
  fi
fi

# ── Step 2: 后端 NestJS ─────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/3] 启动后端 NestJS...${NC}"
if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
  print_ok "后端已在运行 (http://127.0.0.1:${BACKEND_PORT})"
else
  cd "$BACKEND_DIR" || exit 1
  print_info "启动后端进程 (pnpm dev)..."
  nohup pnpm dev >"$BACKEND_LOG" 2>&1 &
  sleep 1
  if wait_for_port "$BACKEND_PORT" 15; then
    if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
      print_ok "后端启动成功 (http://127.0.0.1:${BACKEND_PORT})"
    else
      print_warn "后端端口已开启，但健康检查未通过，查看日志: $BACKEND_LOG"
    fi
  else
    print_err "后端启动超时，查看日志: $BACKEND_LOG"
  fi
fi

# ── Step 3: 前端 Vite ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/3] 启动前端 Vite...${NC}"
if port_is_open "$FRONTEND_PORT"; then
  print_ok "前端已在运行 (http://127.0.0.1:${FRONTEND_PORT})"
else
  cd "$FRONTEND_DIR" || exit 1
  print_info "启动前端进程 (pnpm dev)..."
  nohup pnpm dev --host 127.0.0.1 --port "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1 &
  sleep 1
  if wait_for_port "$FRONTEND_PORT" 10; then
    print_ok "前端启动成功 (http://127.0.0.1:${FRONTEND_PORT})"
  else
    print_err "前端启动失败，查看日志: $FRONTEND_LOG"
  fi
fi

# ── 启动摘要 ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}  ╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}  ║                  服务地址速查                       ║${NC}"
echo -e "${BOLD}  ╠══════════════════════════════════════════════════════╣${NC}"
echo -e "  ║  ${GREEN}🌐 前端应用${NC}       http://127.0.0.1:${FRONTEND_PORT}              ║"
echo -e "  ║  ${GREEN}⚙  后端 API${NC}       http://127.0.0.1:${BACKEND_PORT}              ║"
echo -e "  ║  ${GREEN}❤  健康检查${NC}       http://127.0.0.1:${BACKEND_PORT}/health        ║"
echo -e "  ║  ${CYAN}📖 API 文档${NC}       http://127.0.0.1:${BACKEND_PORT}/api-docs      ║"
echo -e "  ║  ${GREEN}🗄  数据库${NC}         ${DB_HOST}:${DB_PORT}                       ║"
echo -e "${BOLD}  ╠══════════════════════════════════════════════════════╣${NC}"
echo -e "  ║  后端日志: $BACKEND_LOG    ║"
echo -e "  ║  前端日志: $FRONTEND_LOG   ║"
echo -e "${BOLD}  ╠══════════════════════════════════════════════════════╣${NC}"
echo -e "  ║  端口状态:                                           ║"
echo -e "  ║    PostgreSQL :${DB_PORT}  $(port_is_open "$DB_PORT"   && echo -e "${GREEN}✓ 运行中${NC}" || echo -e "${RED}✗ 未运行${NC}")                         ║"
echo -e "  ║    Backend    :${BACKEND_PORT}  $(port_is_open "$BACKEND_PORT" && echo -e "${GREEN}✓ 运行中${NC}" || echo -e "${RED}✗ 未运行${NC}")                         ║"
echo -e "  ║    Frontend   :${FRONTEND_PORT}  $(port_is_open "$FRONTEND_PORT" && echo -e "${GREEN}✓ 运行中${NC}" || echo -e "${RED}✗ 未运行${NC}")                         ║"
echo -e "${BOLD}  ╚══════════════════════════════════════════════════════╝${NC}"
echo ""
