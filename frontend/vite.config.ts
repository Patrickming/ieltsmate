/// <reference types="vitest/config" />
import type { IncomingMessage } from 'http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Dev 代理目标：必须由 **Vite 进程所在环境**（WSL/Linux）解析，
 * 不要依赖浏览器直连后端（若在 Windows 里打开 localhost:5173，fetch 127.0.0.1:3000 会走 Windows 环回，
 * WSL localhost 端口转发尚未就绪时会偶发 Failed to fetch）。
 *
 * start.sh 会设置：`IELTSMATE_BACKEND_PROXY_TARGET=http://127.0.0.1:${BACKEND_PORT}`；
 * 未设置时默认后端在 3000。
 */
const devBackendProxyTarget =
  process.env.IELTSMATE_BACKEND_PROXY_TARGET?.trim() || 'http://127.0.0.1:3000'

const devBackendProxyBypass = (req: IncomingMessage) =>
  req.headers.accept?.includes('text/html') ? req.url : null

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/zustand/') ||
            id.includes('react-router-dom') ||
            id.includes('/react-router/') ||
            id.includes('@remix-run/router')
          ) {
            return 'vendor-core'
          }
          if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('/remark-')) {
            return 'vendor-markdown'
          }
          if (id.includes('framer-motion')) {
            return 'vendor-motion'
          }
        },
      },
    },
  },
  server: {
    // [::] 同时接受 IPv4/IPv6 的 localhost，避免浏览器优先走 ::1 时连不上 dev server
    host: '::',
    proxy: {
      '/notes': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/favorites': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/review': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/settings': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/ai': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/health': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/todos': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/activity': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/dashboard': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/writing-notes': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/writing-assets': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/export': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
      '/import': {
        target: devBackendProxyTarget,
        changeOrigin: true,
        bypass: devBackendProxyBypass,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
    coverage: {
      provider: 'v8',
    },
  },
})
