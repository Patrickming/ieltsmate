#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
BACKUP_DIR="${BACKEND_DIR}/backups"
ENV_FILE="${BACKEND_DIR}/.env"
NOTE_USER_IMAGE_ROOT="${BACKEND_DIR}/uploads"
NOTE_USER_IMAGE_DIR="${NOTE_USER_IMAGE_ROOT}/note-user-images"
NOTE_USER_IMAGE_ARCHIVE_SUFFIX=".note-user-images.tar.gz"
BACKUP_DB_FILENAME="database.dump"
BACKUP_IMAGES_FILENAME="note-user-images.tar.gz"

usage() {
  cat <<'EOF'
数据库备份与恢复脚本（PostgreSQL）

用法:
  ./db-backup.sh
  ./db-backup.sh backup [folder_name]
  ./db-backup.sh restore [folder_name|file]
  ./db-backup.sh list

说明:
  - 不带参数运行时，会进入 1~6 交互菜单
  - 每次 backup 会在 backend/backups 下创建一个独立目录
  - 目录内包含 database.dump 和 note-user-images.tar.gz
  - backup 不传 folder_name 时，自动使用时间戳目录名
  - restore 不传参数时，默认恢复最新备份
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
  local has_entries=0

  if ls -1dt "${BACKUP_DIR}"/*/ >/dev/null 2>&1; then
    has_entries=1
  fi

  if ls -1t "${BACKUP_DIR}"/*.dump >/dev/null 2>&1; then
    has_entries=1
  fi

  if [ "${has_entries}" -eq 0 ]; then
    echo "暂无备份文件。目录: ${BACKUP_DIR}"
    return 0
  fi
  echo "备份列表（新 -> 旧）:"
  while IFS= read -r entry; do
    [ -n "${entry}" ] && printf '%s\n' "${entry%/}"
  done < <(ls -1dt "${BACKUP_DIR}"/*/ 2>/dev/null || true)

  while IFS= read -r entry; do
    [ -n "${entry}" ] && printf '%s\n' "${entry}"
  done < <(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null || true)
}

backup_dir_for_name() {
  local name="$1"
  echo "${BACKUP_DIR}/${name}"
}

backup_dump_file_for_dir() {
  local backup_dir="$1"
  echo "${backup_dir}/${BACKUP_DB_FILENAME}"
}

backup_images_file_for_dir() {
  local backup_dir="$1"
  echo "${backup_dir}/${BACKUP_IMAGES_FILENAME}"
}

default_backup_name() {
  date +%Y-%m-%d_%H-%M-%S
}

note_user_image_archive_for_dump() {
  local dump_file="$1"
  if [[ "${dump_file}" == *.dump ]]; then
    echo "${dump_file%.dump}${NOTE_USER_IMAGE_ARCHIVE_SUFFIX}"
  else
    echo "${dump_file}${NOTE_USER_IMAGE_ARCHIVE_SUFFIX}"
  fi
}

backup_note_user_images() {
  local archive_file="$1"

  if [ -d "${NOTE_USER_IMAGE_DIR}" ]; then
    tar -czf "${archive_file}" -C "${NOTE_USER_IMAGE_ROOT}" note-user-images
    echo "备注图片归档完成: ${archive_file}"
    return 0
  fi

  local temp_dir
  temp_dir="$(mktemp -d)"
  mkdir -p "${temp_dir}/note-user-images"
  if ! tar -czf "${archive_file}" -C "${temp_dir}" note-user-images; then
    rm -rf "${temp_dir}"
    return 1
  fi
  rm -rf "${temp_dir}"
  echo "备注图片归档完成(空目录): ${archive_file}"
}

restore_note_user_images() {
  local archive_file="$1"

  mkdir -p "${NOTE_USER_IMAGE_ROOT}"
  rm -rf "${NOTE_USER_IMAGE_DIR}"

  if [ ! -f "${archive_file}" ]; then
    mkdir -p "${NOTE_USER_IMAGE_DIR}"
    echo "警告: 未找到备注图片归档，已恢复为空目录: ${archive_file}"
    return 0
  fi

  tar -xzf "${archive_file}" -C "${NOTE_USER_IMAGE_ROOT}"
  echo "备注图片恢复完成: ${archive_file}"
}

backup_db() {
  require_cmd pg_dump
  require_cmd tar
  load_env
  mkdir -p "${BACKUP_DIR}"
  local pg_url
  pg_url="$(build_pg_url "${DATABASE_URL}")"

  local name="${1:-$(default_backup_name)}"
  local backup_dir
  backup_dir="$(backup_dir_for_name "${name}")"
  mkdir -p "${backup_dir}"

  local out_file
  out_file="$(backup_dump_file_for_dir "${backup_dir}")"
  local image_archive
  image_archive="$(backup_images_file_for_dir "${backup_dir}")"

  echo "开始备份数据库到: ${out_file}"
  pg_dump \
    --format=custom \
    --blobs \
    --verbose \
    --file="${out_file}" \
    "${pg_url}"

  echo "开始归档备注图片到: ${image_archive}"
  backup_note_user_images "${image_archive}"

  echo "备份完成: ${out_file}"
}

latest_backup_file() {
  ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -n 1
}

latest_backup_dir() {
  ls -1dt "${BACKUP_DIR}"/*/ 2>/dev/null | head -n 1
}

resolve_restore_target() {
  local input="${1:-}"

  if [ -z "${input}" ]; then
    local latest_dir
    latest_dir="$(latest_backup_dir || true)"
    if [ -n "${latest_dir}" ]; then
      echo "${latest_dir%/}"
      return 0
    fi

    latest_backup_file || true
    return 0
  fi

  if [[ "${input}" = /* ]]; then
    if [ -d "${input}" ] || [ -f "${input}" ]; then
      echo "${input}"
    fi
    return 0
  fi

  if [ -d "${BACKUP_DIR}/${input}" ]; then
    echo "${BACKUP_DIR}/${input}"
    return 0
  fi

  if [ -f "${BACKUP_DIR}/${input}" ]; then
    echo "${BACKUP_DIR}/${input}"
    return 0
  fi
}

restore_db() {
  require_cmd pg_restore
  require_cmd tar
  load_env
  mkdir -p "${BACKUP_DIR}"
  local pg_url
  pg_url="$(build_pg_url "${DATABASE_URL}")"

  local input="${1:-}"
  local backup_target=""
  backup_target="$(resolve_restore_target "${input}")"

  local backup_file=""
  local image_archive=""

  if [ -n "${backup_target}" ] && [ -d "${backup_target}" ]; then
    backup_file="$(backup_dump_file_for_dir "${backup_target}")"
    image_archive="$(backup_images_file_for_dir "${backup_target}")"
  else
    backup_file="${backup_target}"
    image_archive="$(note_user_image_archive_for_dump "${backup_file}")"
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

  restore_note_user_images "${image_archive}"

  echo "恢复完成: ${backup_file}"
}

pause() {
  read -r -p "按回车继续..."
}

print_menu() {
  echo ""
  echo "========== 数据库备份菜单 =========="
  echo "1) 备份数据库（按时间目录命名）"
  echo "2) 备份数据库（自定义目录名称）"
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
        read -r -p "请输入备份目录名: " custom_name
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
        read -r -p "请输入备份目录名(如 2026-05-16_04-16-00) 或旧版 .dump 文件名: " filename
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
