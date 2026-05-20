#!/usr/bin/env bash
# 检测 Prisma 迁移状态并在需要时自动执行 migrate deploy / resolve / generate
#
# 用法:
#   ./db-migrate.sh
#   ./db-migrate.sh sync
#   ./db-migrate.sh status
#   ./db-migrate.sh force

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
ENV_FILE="${BACKEND_DIR}/.env"
MIGRATIONS_DIR="${BACKEND_DIR}/prisma/migrations"

usage() {
  cat <<'EOF'
数据库迁移脚本（Prisma / PostgreSQL）

用法:
  ./db-migrate.sh
  ./db-migrate.sh status
  ./db-migrate.sh sync
  ./db-migrate.sh force

说明:
  - 不带参数运行时，会进入 1~4 交互菜单
  - sync：自动检测；若未最新则 resolve + deploy + generate（start.sh 使用）
  - status：仅查看迁移状态，不修改数据库
  - force：无论是否最新都执行 deploy + generate
EOF
}

log() { echo "[db-migrate] $*"; }
warn() { echo "[db-migrate] ⚠ $*" >&2; }
die() { echo "[db-migrate] ✗ $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "未找到命令: $1"
}

load_env() {
  [ -f "${ENV_FILE}" ] || die "未找到 ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  [ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL 未配置"
}

build_pg_url() {
  local raw_url="$1"
  local base="${raw_url%%\?*}"
  local query=""
  local new_query=""
  if [[ "${raw_url}" == *"?"* ]]; then
    query="${raw_url#*\?}"
  fi
  if [ -z "${query}" ]; then
    echo "${base}"
    return 0
  fi
  local part
  IFS='&' read -r -a parts <<< "${query}"
  for part in "${parts[@]}"; do
    if [[ "${part}" == schema=* ]] || [ -z "${part}" ]; then
      continue
    fi
    if [ -z "${new_query}" ]; then
      new_query="${part}"
    else
      new_query="${new_query}&${part}"
    fi
  done
  if [ -n "${new_query}" ]; then
    echo "${base}?${new_query}"
  else
    echo "${base}"
  fi
}

validate_migration_files() {
  local missing=0
  while IFS= read -r -d '' dir; do
    if [ ! -f "${dir}/migration.sql" ]; then
      warn "缺少 migration.sql: ${dir}"
      missing=1
    fi
  done < <(find "${MIGRATIONS_DIR}" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -print0)
  [ "${missing}" -eq 0 ] || die "迁移目录不完整，请补全 migration.sql 后重试"
}

column_exists() {
  local table="$1" column="$2"
  local pg_url="$3"
  local count
  count="$(psql "${pg_url}" -Atqc \
    "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' AND column_name='${column}';" 2>/dev/null || echo 0)"
  [ "${count}" = "1" ]
}

table_exists() {
  local table="$1"
  local pg_url="$2"
  local count
  count="$(psql "${pg_url}" -Atqc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}';" 2>/dev/null || echo 0)"
  [ "${count}" = "1" ]
}

auto_resolve_known_drift() {
  local pg_url="$1"

  resolve_if_applied() {
    local name="$1"
    if (cd "${BACKEND_DIR}" && pnpm prisma migrate resolve --applied "${name}" >/dev/null 2>&1); then
      log "已标记为已应用: ${name}"
    fi
  }

  if column_exists "Note" "partsOfSpeech" "${pg_url}" && column_exists "Note" "confusables" "${pg_url}"; then
    resolve_if_applied "20260409143500_add_note_pos_confusables"
  fi
  if column_exists "Note" "wordFamily" "${pg_url}"; then
    resolve_if_applied "20260409180000_add_note_word_family"
  fi
  if column_exists "NoteUserNote" "images" "${pg_url}"; then
    resolve_if_applied "20260515140600_add_note_user_images"
  fi
  if table_exists "AiReadingReviewBatch" "${pg_url}"; then
    resolve_if_applied "20260519153000_add_ai_reading_review"
  fi
  if column_exists "AiReadingReviewBatch" "modelId" "${pg_url}"; then
    resolve_if_applied "20260519195000_add_ai_reading_batch_model"
  fi
  if column_exists "AiReadingReviewBatch" "errorLog" "${pg_url}"; then
    resolve_if_applied "20260519201500_add_ai_reading_error_log"
  fi
  if column_exists "Note" "pronunciationAudioUrl" "${pg_url}"; then
    resolve_if_applied "20260520120000_add_note_pronunciation_audio"
  fi
}

run_migrate_status() {
  (cd "${BACKEND_DIR}" && pnpm prisma migrate status 2>&1) || true
}

needs_migration() {
  local status_out="$1"
  if echo "${status_out}" | grep -qE 'Database schema is up to date'; then
    return 1
  fi
  if echo "${status_out}" | grep -qE 'following migrations have not yet been applied|P3015|P3009|failed'; then
    return 0
  fi
  if echo "${status_out}" | grep -qiE 'error'; then
    return 0
  fi
  return 1
}

apply_pending_sql_fallback() {
  local pg_url="$1"
  if ! column_exists "Note" "pronunciationAudioUrl" "${pg_url}"; then
    log "兜底 SQL: 添加 Note.pronunciationAudioUrl"
    psql "${pg_url}" -v ON_ERROR_STOP=1 -qc \
      'ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "pronunciationAudioUrl" TEXT;'
    (cd "${BACKEND_DIR}" && pnpm prisma migrate resolve --applied "20260520120000_add_note_pronunciation_audio" >/dev/null 2>&1) || true
  fi
}

print_status() {
  local status_out
  status_out="$(run_migrate_status)"
  echo "${status_out}"
  if needs_migration "${status_out}"; then
    log "结论: 数据库迁移不是最新版本"
    return 1
  fi
  log "结论: 数据库迁移已是最新"
  return 0
}

run_sync() {
  local force="${1:-0}"
  require_cmd psql
  require_cmd pnpm
  load_env
  validate_migration_files

  local pg_url
  pg_url="$(build_pg_url "${DATABASE_URL}")"

  log "检查迁移状态…"
  local status_out
  status_out="$(run_migrate_status)"

  if [ "${force}" -eq 0 ] && ! needs_migration "${status_out}"; then
    log "迁移已是最新，跳过 deploy"
    log "生成 Prisma Client…"
    (cd "${BACKEND_DIR}" && pnpm prisma generate >/dev/null)
    log "完成"
    return 0
  fi

  echo "${status_out}" | sed 's/^/[prisma] /' >&2 || true

  log "尝试自动修复漂移的迁移记录…"
  auto_resolve_known_drift "${pg_url}" || true

  log "执行 prisma migrate deploy…"
  local deploy_ok=0
  if (cd "${BACKEND_DIR}" && pnpm prisma migrate deploy 2>&1 | sed 's/^/[prisma] /'); then
    deploy_ok=1
  else
    warn "migrate deploy 未一次成功，尝试漂移修复后重试…"
    auto_resolve_known_drift "${pg_url}" || true
    if (cd "${BACKEND_DIR}" && pnpm prisma migrate deploy 2>&1 | sed 's/^/[prisma] /'); then
      deploy_ok=1
    fi
  fi

  if [ "${deploy_ok}" -eq 0 ]; then
    warn "deploy 仍失败，尝试兜底 SQL…"
    apply_pending_sql_fallback "${pg_url}"
    auto_resolve_known_drift "${pg_url}" || true
    (cd "${BACKEND_DIR}" && pnpm prisma migrate deploy 2>&1 | sed 's/^/[prisma] /') || die "迁移失败，请查看上方 prisma 输出"
  fi

  log "生成 Prisma Client…"
  (cd "${BACKEND_DIR}" && pnpm prisma generate >/dev/null)

  status_out="$(run_migrate_status)"
  echo "${status_out}" | sed 's/^/[prisma] /' >&2 || true
  if needs_migration "${status_out}"; then
    die "迁移后仍未达到最新状态"
  fi

  log "完成：数据库迁移已是最新"
}

pause() {
  read -r -p "按回车继续..."
}

print_menu() {
  echo ""
  echo "========== 数据库迁移菜单 =========="
  echo "1) 查看迁移状态（只读）"
  echo "2) 自动检测并同步迁移"
  echo "3) 强制执行 migrate deploy + generate"
  echo "4) 退出"
  echo "===================================="
}

interactive_menu() {
  while true; do
    print_menu
    read -r -p "请输入序号 [1-4]: " choice
    case "${choice}" in
      1)
        print_status || true
        pause
        ;;
      2)
        run_sync 0 || true
        pause
        ;;
      3)
        run_sync 1 || true
        pause
        ;;
      4)
        echo "已退出。"
        return 0
        ;;
      *)
        echo "无效输入，请输入 1~4。"
        ;;
    esac
  done
}

main() {
  local action="${1:-}"
  if [ -z "${action}" ]; then
    interactive_menu
    return 0
  fi
  case "${action}" in
    status)
      require_cmd pnpm
      load_env
      validate_migration_files
      print_status
      ;;
    sync)
      run_sync 0
      ;;
    force)
      run_sync 1
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
