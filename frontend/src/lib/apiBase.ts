/**
 * Backend REST base URL.
 * - Override with VITE_API_BASE_URL when needed（例如单独指向某套 API）。
 * - 本地不要用 VITE_API_BASE_URL 指到 127.0.0.1:后端：若在 Windows 浏览器里打开前端，
 *   请求会打在 Windows 环回而非 WSL，冷启动端口转发就绪前会大量 Failed to fetch。
 * - 默认空串走 Vite 同域路径，由 **WSL 内** vite.config 代理到后端（见 IELTSMATE_BACKEND_PROXY_TARGET）。
 * - Production: VITE_API_BASE_URL 或由后端静态托管前端。
 */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL
  if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/$/, '')
  return ''
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
