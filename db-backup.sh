#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
BACKUP_DIR="${BACKEND_DIR}/backups"
ENV_FILE="${BACKEND_DIR}/.env"

usage() {
  cat <<'EOF'
数据库备份与恢复脚本（PostgreSQL）

用法:
  ./db-backup.sh
  ./db-backup.sh backup [name]
  ./db-backup.sh restore [file]
  ./db-backup.sh list

说明:
  - 不带参数运行时，会进入 1~6 交互菜单
  - 备份文件保存在 backend/backups
  - backup 不传 name 时，自动使用时间戳
  - restore 不传 file 时，默认恢复最新备份
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "错误: 未找到命令 '$cmd'，请先安装后重试。"
    exit 1
  fi
}

load_env() {
  if [ ! -f "${ENV_FILE}" ]; then
    echo "错误: 未找到环境文件: ${ENV_FILE}"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  if [ -z "${DATABASE_URL:-}" ]; then
    echo "错误: 环境变量 DATABASE_URL 未配置。"
    exit 1
  fi
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

list_backups() {
  mkdir -p "${BACKUP_DIR}"
  local files
  files=$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null || true)
  if [ -z "${files}" ]; then
    echo "暂无备份文件。目录: ${BACKUP_DIR}"
    return 0
  fi
  echo "备份列表（新 -> 旧）:"
  printf '%s\n' "${files}"
}

backup_db() {
  require_cmd pg_dump
  load_env
  mkdir -p "${BACKUP_DIR}"
  local pg_url
  pg_url="$(build_pg_url "${DATABASE_URL}")"

  local name="${1:-db_$(date +%Y%m%d_%H%M%S)}"
  local out_file="${BACKUP_DIR}/${name}.dump"

  echo "开始备份数据库到: ${out_file}"
  pg_dump \
    --format=custom \
    --blobs \
    --verbose \
    --file="${out_file}" \
    "${pg_url}"

  echo "备份完成: ${out_file}"
}

latest_backup_file() {
  ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -n 1
}

restore_db() {
  require_cmd pg_restore
  load_env
  mkdir -p "${BACKUP_DIR}"
  local pg_url
  pg_url="$(build_pg_url "${DATABASE_URL}")"

  local input="${1:-}"
  local backup_file=""

  if [ -n "${input}" ]; then
    if [[ "${input}" = /* ]]; then
      backup_file="${input}"
    else
      backup_file="${BACKUP_DIR}/${input}"
    fi
  else
    backup_file="$(latest_backup_file || true)"
  fi

  if [ -z "${backup_file}" ] || [ ! -f "${backup_file}" ]; then
    echo "错误: 未找到可恢复的备份文件。"
    echo "可先执行: ./db-backup.sh backup"
    exit 1
  fi

  echo "准备恢复备份: ${backup_file}"
  echo "目标数据库: ${pg_url}"
  echo "5 秒后开始恢复，按 Ctrl+C 可取消..."
  sleep 5

  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    --dbname="${pg_url}" \
    "${backup_file}"

  echo "恢复完成: ${backup_file}"
}

pause() {
  read -r -p "按回车继续..."
}

print_menu() {
  echo ""
  echo "========== 数据库备份菜单 =========="
  echo "1) 备份数据库（自动命名）"
  echo "2) 备份数据库（自定义名称）"
  echo "3) 查看备份列表"
  echo "4) 恢复最新备份"
  echo "5) 恢复指定备份文件"
  echo "6) 退出"
  echo "===================================="
}

interactive_menu() {
  while true; do
    print_menu
    read -r -p "请输入序号 [1-6]: " choice
    case "${choice}" in
      1)
        backup_db
        pause
        ;;
      2)
        local custom_name=""
        read -r -p "请输入备份名称(不含 .dump): " custom_name
        if [ -z "${custom_name}" ]; then
          echo "名称不能为空。"
        else
          backup_db "${custom_name}"
        fi
        pause
        ;;
      3)
        list_backups
        pause
        ;;
      4)
        restore_db
        pause
        ;;
      5)
        local filename=""
        read -r -p "请输入备份文件名(如 db_20260407_120000.dump): " filename
        if [ -z "${filename}" ]; then
          echo "文件名不能为空。"
        else
          restore_db "${filename}"
        fi
        pause
        ;;
      6)
        echo "已退出。"
        return 0
        ;;
      *)
        echo "无效输入，请输入 1~6。"
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
    backup)
      backup_db "${2:-}"
      ;;
    restore)
      restore_db "${2:-}"
      ;;
    list)
      list_backups
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
