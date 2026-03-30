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
