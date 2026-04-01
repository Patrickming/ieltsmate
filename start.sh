#!/usr/bin/env bash
# IELTSmate 一键启动 + 实时监控面板
# 用法:  bash ./start.sh
#        chmod +x ./start.sh && ./start.sh

set -u
set -o pipefail

# ── 路径 / 端口 ──────────────────────────────────────────────────
PROJECT_DIR="/home/pdm/DEV/ieltsmate"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

BACKEND_LOG="/tmp/ieltsmate-backend.log"
FRONTEND_LOG="/tmp/ieltsmate-frontend.log"

DB_HOST="127.0.0.1"
DB_PORT="5432"
BACKEND_PORT="3000"
FRONTEND_PORT="5173"

REFRESH_INTERVAL=4   # 监控面板刷新间隔（秒）
LOG_LINES=10         # 面板内每侧日志行数

# ── 颜色 ─────────────────────────────────────────────────────────
R='\033[0;31m'   # red
G='\033[0;32m'   # green
Y='\033[1;33m'   # yellow
B='\033[0;34m'   # blue
C='\033[0;36m'   # cyan
M='\033[0;35m'   # magenta
W='\033[1;37m'   # bold white
DIM='\033[2m'    # dim
BOLD='\033[1m'
NC='\033[0m'     # reset

# ── 基础工具函数 ──────────────────────────────────────────────────
ok()   { echo -e "${G}  ✓  $1${NC}"; }
warn() { echo -e "${Y}  ⚠  $1${NC}"; }
err()  { echo -e "${R}  ✗  $1${NC}"; }
info() { echo -e "${C}  →  $1${NC}"; }

port_is_open() {
  ss -tln 2>/dev/null | grep -q ":${1} "
}

backend_healthy() {
  curl -fsS --noproxy '*' "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1
}

wait_for_port() {
  local port="$1" retry="$2" i=1
  while [ "$i" -le "$retry" ]; do
    port_is_open "$port" && return 0
    sleep 1; i=$((i + 1))
  done
  return 1
}

# ── 启动序列 ──────────────────────────────────────────────────────
run_startup() {
  echo ""
  echo -e "${BOLD}${C}  ╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${C}  ║   IELTSmate  ·  启动中                   ║${NC}"
  echo -e "${BOLD}${C}  ╚══════════════════════════════════════════╝${NC}"
  echo ""

  # Step 1: PostgreSQL
  echo -e "${Y}  [1/3]  PostgreSQL${NC}"
  if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    ok "PostgreSQL 已在运行 (${DB_HOST}:${DB_PORT})"
  else
    info "尝试启动 PostgreSQL..."
    if ! sudo -n service postgresql start >/dev/null 2>&1; then
      warn "需要 sudo 权限，可能提示输入密码"
      sudo service postgresql start >/dev/null 2>&1 || true
    fi
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
      ok "PostgreSQL 启动成功"
    else
      err "PostgreSQL 未就绪 → sudo service postgresql status"
    fi
  fi

  # Step 2: 后端
  echo ""
  echo -e "${Y}  [2/3]  后端 NestJS${NC}"
  if backend_healthy; then
    ok "后端已在运行 (http://127.0.0.1:${BACKEND_PORT})"
  else
    # 端口被占用但健康检查失败 → 杀掉旧进程
    if port_is_open "$BACKEND_PORT"; then
      warn "端口 ${BACKEND_PORT} 被占用但健康检查失败，正在清理旧进程..."
      local old_pids
      old_pids=$(lsof -ti :"$BACKEND_PORT" 2>/dev/null || true)
      if [ -n "$old_pids" ]; then
        echo "$old_pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        info "旧进程已清理 (PID: $old_pids)"
      fi
    fi
    cd "$BACKEND_DIR" || exit 1
    : > "$BACKEND_LOG"
    info "启动后端进程 (pnpm dev)..."
    nohup pnpm dev >"$BACKEND_LOG" 2>&1 &
    if wait_for_port "$BACKEND_PORT" 20; then
      backend_healthy \
        && ok "后端启动成功 (http://127.0.0.1:${BACKEND_PORT})" \
        || warn "端口已开启但健康检查未通过 → $BACKEND_LOG"
    else
      err "后端启动超时 → $BACKEND_LOG"
    fi
  fi

  # Step 3: 前端
  echo ""
  echo -e "${Y}  [3/3]  前端 Vite${NC}"
  # 判断前端是否真正健康（能返回 HTML）
  if port_is_open "$FRONTEND_PORT" && \
     curl -fsS --noproxy '*' "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1; then
    ok "前端已在运行 (http://127.0.0.1:${FRONTEND_PORT})"
  else
    # 端口被占但服务异常 → 清理
    if port_is_open "$FRONTEND_PORT"; then
      warn "端口 ${FRONTEND_PORT} 被占用但前端无响应，正在清理旧进程..."
      local fe_pids
      fe_pids=$(lsof -ti :"$FRONTEND_PORT" 2>/dev/null || true)
      if [ -n "$fe_pids" ]; then
        echo "$fe_pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        info "旧进程已清理 (PID: $fe_pids)"
      fi
    fi
    cd "$FRONTEND_DIR" || exit 1
    : > "$FRONTEND_LOG"
    info "启动前端进程 (pnpm dev)..."
    nohup pnpm dev --host 127.0.0.1 --port "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1 &
    if wait_for_port "$FRONTEND_PORT" 15; then
      ok "前端启动成功 (http://127.0.0.1:${FRONTEND_PORT})"
    else
      err "前端启动失败 → $FRONTEND_LOG"
    fi
  fi

  echo ""
}

# ── 格式化时间戳 ──────────────────────────────────────────────────
timestamp() { date '+%H:%M:%S'; }
datestamp() { date '+%Y-%m-%d'; }

# ── 服务状态标签（带颜色） ────────────────────────────────────────
svc_label() {
  # $1 = port, $2 = extra health cmd ("" or "backend")
  local port="$1" extra="$2" up=false
  port_is_open "$port" && up=true
  if $up && [ "$extra" = "backend" ]; then
    backend_healthy || up=false
  fi
  if $up; then
    echo -e "${G}● UP${NC}"
  else
    echo -e "${R}● DOWN${NC}"
  fi
}

# 纯文本状态（无颜色），用于对齐计算
svc_state() {
  local port="$1" extra="$2" up=false
  port_is_open "$port" && up=true
  if $up && [ "$extra" = "backend" ]; then
    backend_healthy || up=false
  fi
  $up && echo "UP" || echo "DOWN"
}

# ── 取日志最后 N 行，过滤 ANSI，截断宽度 ─────────────────────────
last_lines() {
  local file="$1" n="$2" width="$3"
  if [ ! -f "$file" ] || [ ! -s "$file" ]; then
    echo -e "${DIM}    (暂无日志)${NC}"
    return
  fi
  tail -n "$n" "$file" 2>/dev/null | while IFS= read -r line; do
    # 去掉 ANSI 转义
    local clean
    clean=$(printf '%s' "$line" | sed 's/\x1b\[[0-9;]*[mGKHF]//g')
    # 截断
    clean="${clean:0:$width}"
    echo -e "  ${DIM}${clean}${NC}"
  done
}

# ── 主监控面板（单次渲染） ────────────────────────────────────────
render_dashboard() {
  local cols
  cols=$(tput cols 2>/dev/null || echo 100)
  local inner=$((cols - 4))       # 内容宽（框线内）
  local half=$(( inner / 2 - 1 )) # 日志两列各宽

  local now
  now=$(timestamp)
  local today
  today=$(datestamp)

  local db_state be_state fe_state
  db_state=$(svc_state "$DB_PORT"      "")
  be_state=$(svc_state "$BACKEND_PORT" "backend")
  fe_state=$(svc_state "$FRONTEND_PORT" "")

  # ── 顶部标题 ────────────────────────────────────────────────────
  clear
  printf "${BOLD}${C}"
  printf '  ╔'; printf '═%.0s' $(seq 1 $((cols - 4))); printf '╗\n'
  # 标题行
  local title="  IELTSmate  监控面板"
  local ts_str="  ${today}  ${now}  "
  printf "  ║${NC}${BOLD}${W}%-*s${NC}${DIM}%*s${NC}${BOLD}${C}  ║\n" \
    $(( (cols - 4 - ${#ts_str}) )) "$title" "${#ts_str}" "$ts_str"
  printf "${BOLD}${C}  ╠"; printf '═%.0s' $(seq 1 $((cols - 4))); printf '╣\n'
  printf "  ╚"; printf '═%.0s' $(seq 1 $((cols - 4))); printf "╝${NC}\n"

  # ── 服务状态卡片 ─────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}${W}服务状态${NC}"
  echo -e "  ${DIM}──────────────────────────────────────────────────────────${NC}"

  local db_lbl be_lbl fe_lbl
  db_lbl=$(svc_label "$DB_PORT"       "")
  be_lbl=$(svc_label "$BACKEND_PORT"  "backend")
  fe_lbl=$(svc_label "$FRONTEND_PORT" "")

  # PostgreSQL
  printf "  ${M}%-16s${NC}" "PostgreSQL"
  printf " %b" "$db_lbl"
  printf "  ${DIM}%s:%-6s${NC}" "$DB_HOST" "$DB_PORT"
  if [ "$db_state" = "UP" ]; then
    printf "  ${G}pg_isready OK${NC}"
  fi
  echo ""

  # 后端
  printf "  ${M}%-16s${NC}" "Backend  NestJS"
  printf " %b" "$be_lbl"
  printf "  ${DIM}http://127.0.0.1:%-6s${NC}" "$BACKEND_PORT"
  if [ "$be_state" = "UP" ]; then
    printf "  ${G}/health OK${NC}  ${DIM}API: http://127.0.0.1:${BACKEND_PORT}/api-docs${NC}"
  fi
  echo ""

  # 前端
  printf "  ${M}%-16s${NC}" "Frontend Vite"
  printf " %b" "$fe_lbl"
  printf "  ${DIM}http://127.0.0.1:%-6s${NC}" "$FRONTEND_PORT"
  if [ "$fe_state" = "UP" ]; then
    printf "  ${G}dev server OK${NC}"
  fi
  echo ""

  # ── 整体状态横幅 ─────────────────────────────────────────────────
  echo ""
  if [ "$db_state" = "UP" ] && [ "$be_state" = "UP" ] && [ "$fe_state" = "UP" ]; then
    echo -e "  ${BOLD}${G}  ✦  所有服务正常运行  ✦${NC}"
  else
    local down_list=""
    [ "$db_state" != "UP" ] && down_list+=" PostgreSQL"
    [ "$be_state" != "UP" ] && down_list+=" Backend"
    [ "$fe_state" != "UP" ] && down_list+=" Frontend"
    echo -e "  ${BOLD}${R}  ✗  服务异常:${down_list}${NC}"
  fi

  # ── 日志区（左：后端 / 右：前端） ───────────────────────────────
  echo ""
  echo -e "  ${BOLD}${W}实时日志${NC}  ${DIM}(最近 ${LOG_LINES} 行)${NC}"
  echo -e "  ${DIM}──────────────────────────────────────────────────────────${NC}"

  # 列标题
  printf "  ${C}${BOLD}%-*s${NC}" $((half + 2)) "后端  $BACKEND_LOG"
  printf "  ${C}${BOLD}%-*s${NC}\n" $((half + 2)) "前端  $FRONTEND_LOG"

  # 并排显示日志
  local be_lines fe_lines
  mapfile -t be_lines < <(last_lines "$BACKEND_LOG"  "$LOG_LINES" "$half")
  mapfile -t fe_lines < <(last_lines "$FRONTEND_LOG" "$LOG_LINES" "$half")

  local max_i=$(( LOG_LINES > ${#be_lines[@]} ? LOG_LINES : ${#be_lines[@]} ))
  local total_i=$(( max_i > ${#fe_lines[@]} ? max_i : ${#fe_lines[@]} ))

  for (( i=0; i<total_i; i++ )); do
    local bl="${be_lines[$i]:-}"
    local fl="${fe_lines[$i]:-}"
    # 去掉前缀 2 空格（last_lines 已加了），截到 half 宽
    printf "  %-*b  %-*b\n" "$half" "$bl" "$half" "$fl"
  done

  # ── 快捷键提示 ───────────────────────────────────────────────────
  echo ""
  echo -e "  ${DIM}──────────────────────────────────────────────────────────${NC}"
  echo -e "  ${DIM}Ctrl+C 退出监控    刷新间隔 ${REFRESH_INTERVAL}s    日志: /tmp/ieltsmate-*.log${NC}"
  echo ""
}

# ── 退出处理 ──────────────────────────────────────────────────────
on_exit() {
  echo ""
  echo -e "${Y}  已退出监控面板。后台服务仍在运行。${NC}"
  echo -e "${DIM}  停止后端: kill \$(lsof -ti :${BACKEND_PORT})${NC}"
  echo -e "${DIM}  停止前端: kill \$(lsof -ti :${FRONTEND_PORT})${NC}"
  echo ""
  exit 0
}
trap on_exit INT TERM

# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════
run_startup

echo ""
echo -e "${C}  进入实时监控面板 (每 ${REFRESH_INTERVAL}s 刷新)...  按 Ctrl+C 退出${NC}"
sleep 1

while true; do
  render_dashboard
  sleep "$REFRESH_INTERVAL"
done
