import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
