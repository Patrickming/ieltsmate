/**
 * Backend REST base URL.
 * - Override at any time with VITE_API_BASE_URL env variable.
 * - In dev mode the Vite server proxy (vite.config.ts server.proxy) forwards
 *   /notes, /favorites, /review, /health → http://127.0.0.1:3000, so we use
 *   a relative base (empty string) to stay same-origin and avoid CORS issues.
 * - In production, set VITE_API_BASE_URL or ensure backend serves the frontend.
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
