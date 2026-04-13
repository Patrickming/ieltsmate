/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    proxy: {
      '/notes': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/favorites': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/review': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/settings': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/ai': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/todos': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/activity': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/dashboard': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/writing-notes': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/writing-assets': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/export': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
      },
      '/import': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        bypass: (req) => req.headers['accept']?.includes('text/html') ? req.url : null,
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
