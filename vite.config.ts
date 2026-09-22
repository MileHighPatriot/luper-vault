import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/; the deploy workflow sets this.
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Uncommon port to avoid clashing with other local dev servers.
    port: 4177,
    strictPort: true,
    host: '127.0.0.1',
    // Public tunnels and hosts (Cloudflare, Pages) are not localhost.
    allowedHosts: true,
  },
  preview: {
    port: 4188,
    strictPort: true,
    host: '127.0.0.1',
    allowedHosts: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
