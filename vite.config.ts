import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [vue(), cloudflare()],
  server: { host: '127.0.0.1', port: 5173 },
  build: { chunkSizeWarningLimit: 1000 },
})
