import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue({ template: { transformAssetUrls: false } })],
  test: {
    environment: 'happy-dom',
    include: ['tests/components/**/*.spec.ts'],
    restoreMocks: true,
  },
})
